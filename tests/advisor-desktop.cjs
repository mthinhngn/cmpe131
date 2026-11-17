// Paid live Kimi test on the canonical app; all changes stay in a fresh guest tab.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], receipts = [], responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().endsWith('/agent/action-results')) receipts.push(request.postDataJSON()); });
  page.on('response', async response => { if (/\/agent\/requests\//.test(response.url()) && response.request().method() === 'GET') responses.push(await response.json().catch(() => ({}))); });
  async function send(text) {
    const ask = page.getByRole('button', { name: 'Ask', exact: true });
    if (await ask.getAttribute('aria-pressed') !== 'true') await ask.click();
    const count = await page.locator('.cr-chat-turn').count();
    await page.getByLabel('Message Course Radar', { exact: true }).fill(text);
    await page.getByLabel('Send message', { exact: true }).click();
    await page.waitForFunction(count => document.querySelectorAll('.cr-chat-turn').length > count && !document.querySelectorAll('.cr-chat-turn')[count].querySelector('.cr-chat-working'), count, { timeout: 120000 });
    return page.locator('.cr-chat-turn').last().innerText();
  }
  try {
    await page.goto('http://127.0.0.1:5175/planner');
    await page.getByRole('button', { name: 'Ask', exact: true }).waitFor();
    await page.evaluate(async () => {
      const { PersistentPlanningStore } = await import('/src/PersistentPlanningStore.ts');
      const store = new PersistentPlanningStore(); await store.load();
      const starting = await store.setStartingTerm('fall-2026');
      if (starting.status === 'error') throw Error(starting.message);
      for (const code of ['CMPE 50', 'CS 46B', 'CMPE 70', 'CMPE 126']) {
        const course = store.getState().catalog.courses.find(c => c.code === code);
        if (!course) throw Error('Missing fixture prerequisite ' + code);
        const result = await store.toggleTakenCourse(course.id);
        if (result.status === 'error') throw Error(result.message);
      }
      for (const [id, semester] of [['ce-cmpe131', 6], ['ce-cmpe142', 7]]) {
        const result = await store.setPlan(id, semester);
        if (result.status === 'error') throw Error(result.message);
      }
    });
    await page.reload();
    const reply = await send('Swap CMPE 131 and CMPE 142');
    assert.match(reply, /applied and verified/i);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].status, 'succeeded');
    assert.equal(receipts[0].context.plan.find(p => p.course_id === 'ce-cmpe131').semester_slot, 7);
    assert.equal(receipts[0].context.plan.find(p => p.course_id === 'ce-cmpe142').semester_slot, 6);
    assert.ok(responses.some(r => r.status === 'awaiting_action' && !/applied and verified/i.test(r.reply || '')));
    const lookup = await send('How many units is HIST 15 in the captured catalog? Include a source.');
    assert.match(lookup, /3(?:\.0)? units/i);
    assert.ok(await page.locator('.cr-chat-turn').last().locator('.cr-chat-sources a').count());
    await page.screenshot({ path: 'tmp/advisor-desktop.png' });
    await page.reload();
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.cr-chat-messages')?.textContent.includes('applied and verified'));
    assert.equal(receipts.length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: canonical desktop live Kimi swap, save/ack ordering, citations and reload without replay.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
