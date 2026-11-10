import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { loadEnv } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = 'http://localhost:5175';
const api = 'http://127.0.0.1:3004';
const agent = 'http://127.0.0.1:8000';

export async function jsonHealth(url, valid) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.ok && !!valid(await response.json());
  } catch { return false; }
}

export function portOpen(host, port) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

export async function waitFor(label, check, failure = () => '', timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const error = failure();
    if (error) throw Error(error);
    if (await check()) return;
    await delay(500);
  }
  throw Error(`${label} did not become ready in ${timeout / 1000}s. Check tmp/dev-all/${label}.log.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--no-open')) throw Error('Usage: npm run dev:all -- [--no-open]');
  const apiEnv = { ...loadEnv('development', join(root, 'api'), ''), ...process.env };
  const agentEnv = { ...loadEnv('development', root, ''), ...process.env };
  const children = [];
  let stopping = false;
  let finished = false;
  let serviceFailure = '';
  const npm = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  mkdirSync(join(root, 'tmp/dev-all'), { recursive: true });

  async function cleanup(code) {
    if (stopping) return;
    stopping = true;
    console.log('\n[dev:all] Stopping processes started by this launcher; reused services and databases stay running.');
    for (const child of children.reverse()) {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
      if (process.platform === 'win32') {
        await new Promise(resolve => {
          const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          stop.once('error', resolve); stop.once('exit', resolve);
        });
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
      }
    }
    process.exit(code);
  }
  process.once('SIGINT', () => void cleanup(0));
  process.once('SIGTERM', () => void cleanup(0));

  function launch(label, command, args, cwd = root, env = process.env, persistent = true) {
    const log = createWriteStream(join(root, `tmp/dev-all/${label}.log`));
    const child = spawn(command, args, { cwd, env, windowsHide: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    const fail = detail => {
      if (stopping) return;
      serviceFailure = `${label} ${detail}. See tmp/dev-all/${label}.log.`;
      if (finished) { console.error(`[dev:all] ${serviceFailure}`); void cleanup(1); }
    };
    child.once('error', error => fail(`could not start (${error.code})`));
    child.once('exit', (code, signal) => {
      log.end();
      if (persistent || code !== 0) fail(`exited (${signal || code})`);
    });
    return child;
  }

  async function ensureService(label, host, port, check, start) {
    if (await check()) { console.log(`[dev:all] Reusing healthy ${label} on ${port}.`); return; }
    if (await portOpen(host, port)) throw Error(`Port ${port} is occupied but ${label} is not healthy. Check that service before retrying; it was not stopped.`);
    console.log(`[dev:all] Starting ${label}; log: tmp/dev-all/${label}.log`);
    start();
    await waitFor(label, check, () => serviceFailure);
    console.log(`[dev:all] ${label} ready.`);
  }

  try {
    for (const [key, service, expectedPort] of [['DATABASE_URL', 'postgres', 5432], ['USER_DATABASE_URL', 'users-postgres', 5433]]) {
      if (!apiEnv[key]) throw Error(`Set ${key} in api/.env first (see api/.env.example).`);
      const url = new URL(apiEnv[key]);
      const port = Number(url.port || 5432);
      if (await portOpen(url.hostname, port)) { console.log(`[dev:all] Reusing reachable ${service}.`); continue; }
      if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || port !== expectedPort) {
        throw Error(`${service} is unavailable at the configured address. Start your configured database and retry.`);
      }
      console.log(`[dev:all] Starting Docker database ${service}.`);
      const child = launch(service, 'docker', ['compose', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '60', service], root, process.env, false);
      await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(Error(`Docker could not start ${service}. Start Docker Desktop and check tmp/dev-all/${service}.log.`)));
      });
      await waitFor(service, () => portOpen(url.hostname, port), () => serviceFailure);
    }

    const apiCheck = async () => await jsonHealth(`${api}/api/v1/health`, value => value.status === 'ok' && value.database === 'connected')
      && await jsonHealth(`${api}/api/v1/auth/me`, value => Object.hasOwn(value, 'user'));
    await ensureService('api', '127.0.0.1', 3004, apiCheck, () => launch('api', process.execPath, [npm, 'run', 'dev'], join(root, 'api'), {
      ...apiEnv, PORT: '3004', WEB_ORIGIN: `${web},http://127.0.0.1:5175`, AUTH_WEB_ORIGIN: web,
    }));
    const agentCheck = () => jsonHealth(`${agent}/agent/health`, value => value.status === 'ok' && value.agents?.includes('course_action'));
    const localPython = join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    await ensureService('agent', '127.0.0.1', 8000, agentCheck, () => launch('agent', process.env.PYTHON || (existsSync(localPython) ? localPython : 'python'),
      ['-m', 'uvicorn', 'agent_service.server:app', '--host', '127.0.0.1', '--port', '8000'], root, {
        ...agentEnv, KIMI_AUTH_URL: `${api}/api/v1/auth/me`, WEB_ORIGIN: `${web},http://127.0.0.1:5175`,
      }));

    const frontendCheck = async () => {
      try {
        const response = await fetch(web, { signal: AbortSignal.timeout(2000) });
        return response.ok && (await response.text()).includes('/src/main.tsx')
          && await jsonHealth(`${web}/api/v1/auth/me`, value => Object.hasOwn(value, 'user'))
          && await jsonHealth(`${web}/api/v1/health`, value => value.status === 'ok' && value.database === 'connected')
          && await jsonHealth(`${web}/api/v1/agent/health`, value => value.agents?.includes('course_action'));
      } catch { return false; }
    };
    await ensureService('frontend', 'localhost', 5175, frontendCheck, () => launch('frontend', process.execPath,
      [join(root, 'node_modules/vite/bin/vite.js'), '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', '5175', '--strictPort'], root, {
        ...process.env, COURSE_RADAR_API_TARGET: api, COURSE_RADAR_AGENT_TARGET: agent,
        VITE_API_URL: '/api/v1', VITE_AGENT_URL: '/api/v1/agent',
      }));
    finished = true;
    console.log(`[dev:all] Ready: ${web}\n[dev:all] Press Ctrl+C to stop. Logs: tmp/dev-all/`);
    const health = await fetch(`${agent}/agent/health`, { signal: AbortSignal.timeout(2000) }).then(response => response.json());
    if (!health.groq_configured || !health.web_search_configured) console.warn('[dev:all] AI provider keys are missing. Configure GROQ_API_KEY and TAVILY_API_KEY in .env to use live AI/search.');
    if (!args.includes('--no-open')) {
      const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      const opener = spawn(command, process.platform === 'win32' ? ['url.dll,FileProtocolHandler', web] : [web], { stdio: 'ignore', windowsHide: true });
      opener.once('error', () => console.warn(`[dev:all] Open ${web} in your browser.`));
    }
    let checking = false;
    let failedChecks = 0;
    setInterval(async () => {
      if (stopping || checking) return;
      checking = true;
      if (await frontendCheck()) failedChecks = 0;
      else if (!stopping) {
        failedChecks += 1;
        if (failedChecks < 3) console.warn(`[dev:all] Service check failed (${failedChecks}/3); retrying while services recover.`);
        else {
          console.error('[dev:all] A service or API proxy stayed unavailable. Check tmp/dev-all/ and restart npm run dev:all.');
          void cleanup(1);
        }
      }
      checking = false;
    }, 15000).unref();
    // Keep the launcher active even when every service was reused.
    await new Promise(() => { setInterval(() => {}, 60000); });
  } catch (error) {
    console.error(`[dev:all] ${error.message}`);
    await cleanup(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[dev:all] ${error.message}`); process.exitCode = 1; });
}
