// Paid live test: the canonical ChatWidget and an isolated authenticated workspace.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('../api/node_modules/dotenv').config({ path: path.resolve('api/.env'), quiet: true });
const { PrismaClient } = require('../api/generated/users');
let pw;
try { pw = require('playwright'); } catch {
  pw = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const db = new PrismaClient();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const token = crypto.randomBytes(32).toString('hex');
const workspaceKey = crypto.randomBytes(32).toString('hex');
const base = 'http://localhost:5175';
let user, browser;
(async () => {
  try {
    user = await db.user.create({ data: { email: `compound-${token.slice(0, 12)}@example.com`, workspaceKey,
      name: 'Compound Action Test', major: 'computer-engineering', startingSemester: 'Fall 2026' } });
    await db.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 600000) } });
    browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.context().addCookies([{ name: 'cr_session', value: token, url: base + '/api/v1', httpOnly: true, sameSite: 'Lax' }]);
    const receipts = [], errors = [];
    let saves = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().endsWith('/workspace/operations') && response.ok()) saves++;
    });
    page.on('request', request => {
      if (request.url().endsWith('/agent/action-results')) receipts.push({ ...request.postDataJSON(), saves });
    });
    await page.goto(base + '/planner');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByLabel('Message Course Radar', { exact: true }).fill(process.env.PLANNER_TEST_PROMPT || 'Add CMPE131 to the current semester and CMPE142 to the next semester');
    const completed = page.waitForResponse(async response => {
      if (!response.url().includes('/agent/requests/') || response.request().method() !== 'GET') return false;
      return ['completed', 'failed'].includes((await response.json()).status);
    }, { timeout: 150000 });
    await page.getByLabel('Send message', { exact: true }).click();
    const result = await (await completed).json();
    const reply = result.reply;
    console.log('Reply:', reply);
    assert.equal(receipts.length, 2, 'Both additions must execute from one message');
    for (const [index, receipt] of receipts.entries()) {
      assert.equal(receipt.status, 'succeeded');
      assert.ok(receipt.saves >= index + 1, 'Workspace save precedes action acknowledgement');
    }
    assert.doesNotMatch(reply, /please (?:reply|confirm)|authorize you|confirm again/i);
    async function verifySaved() {
      const response = await page.request.get(base + '/api/v1/workspace', { headers: { 'X-Workspace-User': user.id } });
      assert.ok(response.ok());
      const saved = await response.json();
      const plan = saved.state.plans['computer-engineering'];
      assert.equal(plan['ce-cmpe131'].semester, 1);
      assert.equal(plan['ce-cmpe142'].semester, 2);
      assert.equal(Object.keys(plan).length, 2);
    }
    await verifySaved();
    await page.reload();
    await page.getByRole('button', { name: 'Ask', exact: true }).waitFor();
    await verifySaved();
    assert.equal(receipts.length, 2, 'Reload must not replay additions');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: 'tmp/compound-add-desktop.png' });
    console.log('PASS: one message, two authenticated saves, acknowledgements after persistence, correct relative terms and reload without replay.');
  } finally {
    if (browser) await browser.close();
    if (user) {
      const workspace = await db.personalWorkspace.findUnique({ where: { tokenHash: hash(workspaceKey) } });
      if (workspace) {
        await db.personalOperation.deleteMany({ where: { workspaceId: workspace.id } });
        await db.personalWorkspace.delete({ where: { id: workspace.id } });
      }
      await db.session.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
      execFileSync('python', ['-c', "import sys; from agent_service.catalog import database_url; import psycopg; c=psycopg.connect(database_url()); c.execute('DELETE FROM kimi_memory WHERE owner=%s',(sys.argv[1],)); c.commit(); c.close()", 'account:' + user.id]);
    }
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
