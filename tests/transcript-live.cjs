// Run through tests/transcript-live.py, which creates and cleans an isolated local account.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }

(async () => {
  console.log('Starting isolated desktop transcript test.');
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: 'cr_session', value: process.env.TRANSCRIPT_TEST_SESSION, url: 'http://127.0.0.1:5175/api/v1', httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5175/account');
    console.log('Opened fresh account setup.');
    await page.getByRole('button', { name: 'Upload your transcript', exact: false }).click();
    await page.getByRole('heading', { name: 'Upload your transcript', exact: true }).waitFor();
    await page.locator('input[type=file]').setInputFiles('tmp/synthetic-transcript.pdf');
    await page.getByLabel('I agree to send this PDF to OpenAI for transcript extraction and search indexing.').check();
    await page.getByRole('button', { name: 'Process transcript', exact: true }).click();
    console.log('Submitted synthetic transcript without a major.');
    await page.waitForFunction(() => document.querySelector('.acct-error') || document.querySelectorAll('.acct-transcript-row').length === 3, null, { timeout: 90000 });
    assert.equal(await page.locator('.acct-error').count(), 0,
      await page.locator('.acct-error').allTextContents().then(lines => lines.join(' ')));
    assert.equal(await page.locator('.acct-transcript-row').count(), 3);
    const unmatched = page.locator('.acct-transcript-row').filter({ hasText: 'ZZZZ 999' });
    assert.equal(await unmatched.locator('input').isDisabled(), true);
    const progress = page.locator('.acct-transcript-row').filter({ hasText: 'MATH 30' });
    assert.equal(await progress.locator('input').isEnabled(), true);
    assert.equal(await progress.locator('input').isChecked(), true);
    await page.getByRole('button', { name: 'Continue to your details', exact: true }).click();
    await page.getByRole('button', { name: 'Current major', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search current major', exact: true }).fill('Computer Engineering');
    await page.getByRole('option', { name: /^Computer Engineering/ }).first().click();
    await page.getByRole('radio', { name: 'Fall', exact: true }).check();
    await page.getByRole('button', { name: 'Year', exact: true }).click();
    await page.getByRole('option', { name: '2025', exact: true }).click();
    const confirmation = page.waitForResponse(r => r.url().endsWith('/transcript/confirm'));
    await page.getByRole('button', { name: 'Save, import and open planner', exact: true }).click();
    assert.equal((await confirmation).status(), 200);
    await page.waitForURL('**/planner', { timeout: 90000 });
    await page.getByRole('button', { name: 'HIST 15, completed', exact: true }).waitFor();
    await page.getByRole('button', { name: 'MATH 30', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'HIST 15, completed', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'HIST 15, completed', exact: true }).count(), 1);
    const workspace = await context.request.get('http://127.0.0.1:5175/api/v1/workspace', { headers: { 'X-Workspace-User': process.env.TRANSCRIPT_TEST_OWNER } }).then(r => r.json());
    assert.ok(workspace.state.completed.includes('sjsu-hist-15'));
    assert.equal(workspace.state.completed.length, 1);
    assert.equal(workspace.state.plans['computer-engineering']['sjsu-hist-15'].semester, 1);
    assert.equal(workspace.state.plans['computer-engineering'][workspace.state.catalog.courses.find(c => c.code === 'MATH 30').id].semester, 2);
    assert.equal(workspace.state.plans['computer-engineering'][workspace.state.catalog.courses.find(c => c.code === 'MATH 30').id].status, 'in-progress');
    await page.getByRole('button', { name: 'Edit Semester 1, 3 units', exact: true }).waitFor();
    await page.screenshot({ path: 'tmp/transcript-desktop.png', fullPage: true });
    await page.goto('http://127.0.0.1:5175/account');
    const again = page.waitForResponse(r => r.url().endsWith('/transcript/confirm'));
    await page.getByRole('button', { name: 'Import to Planner', exact: true }).click();
    assert.equal((await again).status(), 200);
    await page.waitForURL('**/planner');
    await page.getByRole('button', { name: 'HIST 15, completed', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'HIST 15, completed', exact: true }).count(), 1);
    await page.goto('http://127.0.0.1:5175/account');
    const deletion = page.waitForResponse(r => r.url().endsWith('/transcript') && r.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Delete transcript', exact: true }).click();
    assert.equal((await deletion).status(), 200);
    await page.getByText('Transcript deleted.', { exact: true }).waitFor();
    const after = await context.request.get('http://127.0.0.1:5175/api/v1/workspace', { headers: { 'X-Workspace-User': process.env.TRANSCRIPT_TEST_OWNER } }).then(r => r.json());
    assert.deepEqual(after.state.completed, workspace.state.completed);
    assert.deepEqual(after.state.plans, workspace.state.plans);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop onboarding upload before major selection, actual OpenAI extraction/embeddings, automatic Planner import, recorded terms/statuses, reload, duplicate import and deletion; plan preserved.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
