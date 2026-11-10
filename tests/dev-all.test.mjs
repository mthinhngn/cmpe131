import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { jsonHealth, portOpen, waitFor } from '../scripts/dev-all.mjs';

test('readiness rejects HTML fallback, HTTP failures and unrelated JSON', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/html') return res.end('<!doctype html>');
    if (req.url === '/error') res.statusCode = 503;
    res.end(JSON.stringify({ status: req.url === '/other' ? 'other-app' : 'ok' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  assert.equal(await portOpen('127.0.0.1', port), true);
  for (const path of ['/html', '/error', '/other']) assert.equal(await jsonHealth(base + path, value => value.status === 'ok'), false);
  assert.equal(await jsonHealth(base, value => value.status === 'ok'), true);
});

test('startup stops waiting immediately when a child fails', async () => {
  await assert.rejects(waitFor('api', async () => false, () => 'api exited'), /api exited/);
  await assert.rejects(waitFor('api', async () => false, () => '', 1), /did not become ready/);
  await waitFor('api', async () => true);
});
