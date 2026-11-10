import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
const base = 'http://localhost:5175';
await mkdir('tmp/consolidation', {recursive:true});
const ready = () => page.waitForFunction(() => document.querySelector('.persistence-content')?.disabled === false);
const workspace = () => page.evaluate(async () => {
  const credential = localStorage.getItem('course-radar-workspace-credential-v1');
  const response = await fetch('/api/v1/workspace', {headers:{Authorization:`Bearer ${credential}`}});
  return response.json();
});
try {
  for (const path of ['/', '/overview', '/schedule', '/roadmap', '/planner', '/account']) {
    await page.goto(base + path);
    await page.locator('h1').first().waitFor();
    if (path !== '/account') await ready();
    await page.evaluate(async () => { await Promise.race([new Promise(resolve => setTimeout(resolve,1200)), Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))]); });
    assert.equal(await page.locator('.cr-chat-widget').count(), ['/', '/account'].includes(path) ? 0 : 1);
    await page.screenshot({path:`tmp/consolidation/${path.slice(1) || 'home'}.png`});
    results.push(`PASS desktop route ${path}`);
  }
  // Only this isolated browser routes agent requests to the controlled test service.
  await page.route('**/agent/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({url:`http://127.0.0.1:8013${url.pathname}${url.search}`});
    await route.fulfill({response});
  });
  await page.goto(base + '/planner'); await ready();
  async function send(text, reply) {
    const count = await page.locator('.cr-chat-turn').count();
    await page.getByLabel('Message Course Radar', {exact:true}).fill(text);
    await page.getByRole('button', {name:'Send message', exact:true}).click();
    await page.waitForFunction(n => document.querySelectorAll('.cr-chat-turn').length > n, count);
    await page.locator('.cr-chat-turn').last().getByText(reply).waitFor({timeout:60000});
    await ready(); results.push(`PASS ${text}`);
  }
  await send('Add CMPE 131 to my current semester', /starting academic term/i);
  await send('Fall 2025', /Added CMPE 131/);
  let saved = await workspace();
  const program = saved.state.program, course = saved.state.catalog.courses.find(c=>c.code==='CMPE 131').id;
  assert.equal(saved.state.plans[program][course].semester,3);
  await page.getByRole('button',{name:'Planning settings',exact:true}).click();
  await page.locator('#cr-chat-settings').getByText('Semester 3',{exact:true}).waitFor();
  await page.locator('#cr-chat-settings').getByText(/Spring 2027.*Semester 4/).waitFor();
  await page.screenshot({path:'tmp/consolidation/semester-profile.png'});
  await page.getByRole('button',{name:'New conversation',exact:true}).click();
  await send('Move CMPE 131 to next semester', /Moved CMPE 131/);
  saved=await workspace(); assert.equal(saved.state.plans[program][course].semester,4);
  const cachedRun = await page.locator('.cr-chat-turn').last().textContent();
  assert.ok(cachedRun.includes('Reused shared verified calendar'));
  assert.ok(!cachedRun.includes('lookup_offering'));
  await page.getByRole('button',{name:'Planning settings',exact:true}).click();
  results.push('PASS saved semester profile and cross-conversation calendar reuse');
  await page.getByRole('button',{name:'Remove CMPE 131 from plan',exact:true}).waitFor();
  await send('Remove CMPE 131 from my plan', /Removed CMPE 131/);
  assert.equal((await workspace()).state.plans[program][course], undefined);
  await send('Add CMPE 131 to Summer 2027', /Added CMPE 131/);
  saved=await workspace(); assert.equal(saved.state.plans[program][course].semester,'summer-2027');
  await page.getByRole('button',{name:'Remove CMPE 131 from plan',exact:true}).waitFor();
  await page.screenshot({path:'tmp/consolidation/agent-saved-plan.png'});
  await page.reload(); await ready();
  saved = await workspace(); assert.equal(saved.state.plans[program][course].semester,'summer-2027');
  assert.equal(saved.state.startingTerms[program],'fall-2025');
  assert.deepEqual(saved.state.messages, {});
  assert.ok((await page.locator('.cr-chat-turn').allTextContents()).some(text=>text.includes('Added CMPE 131')));
  results.push('PASS reload preserves plan, profile and conversation');
  // Course drawer also works in the separate Overview document.
  await page.goto(base + '/overview'); await ready();
  await page.getByLabel('Message Course Radar',{exact:true}).fill('Open CMPE 131');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.locator('[role="dialog"] #course-title').waitFor({timeout:60000});
  results.push('PASS Overview agent course drawer');
  await page.goto(base + '/overview'); await ready();
  await page.getByLabel('Message Course Radar',{exact:true}).fill('Remove CMPE 131 from my plan');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.waitForURL('**/planner?semester=summer-2027'); await ready();
  assert.equal((await workspace()).state.plans[program][course],undefined);
  results.push('PASS Overview saved action acknowledges before document navigation');
  if (process.env.LIVE_AGENT_TEST === '1') {
    await page.unroute('**/agent/**');
    await page.goto(base + '/planner'); await ready();
    await page.getByLabel('Message Course Radar',{exact:true}).fill('Add CMPE 131 to my current semester');
    await page.getByRole('button',{name:'Send message',exact:true}).click();
    await page.waitForFunction(() => {
      const text=Array.from(document.querySelectorAll('.cr-chat-turn')).at(-1)?.textContent || '';
      return /Added CMPE 131|rate limit|could not complete|timed out/i.test(text);
    },null,{timeout:60000});
    const live = await page.locator('.cr-chat-turn').last().textContent();
    if (live.includes('Added CMPE 131')) {
      assert.ok(live.includes('Reused shared verified calendar'));
      assert.ok(!live.includes('web_search.search_official'));
      assert.ok(!live.includes('lookup_offering'));
      assert.equal((await workspace()).state.plans[program][course].semester,3);
      results.push('PASS live Groq + persisted calendar + actual saved planner add');
    } else results.push('LIVE provider limitation: ' + live);
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile('tmp/consolidation/results.json',JSON.stringify({results,errors},null,2));
  console.log(results.join('\n')); console.log('Page errors:',errors);
  await browser.close();
}
