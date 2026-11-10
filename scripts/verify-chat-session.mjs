import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {})});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const results = [], errors = [], messages = [], operations = [];
const base = 'http://localhost:5175';
let holdMove = false, notifySaved, releaseMove;
const moveSaved = new Promise(resolve => {notifySaved=resolve;});
const moveRelease = new Promise(resolve => {releaseMove=resolve;});
const expectedError = 'HTTPS connection or download timed out for www.sjsu.edu. No automatic retry was attempted.';
await context.route('**/agent/**',async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/agent/messages') {
    const body = route.request().postDataJSON(); messages.push(body);
    if (body.message === 'Show existing error') {
      await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({request_id:body.request_id,status:'failed',reply:expectedError,action:null,events:[],trace_id:''})});
      return;
    }
  }
  const response = await route.fetch({url:`http://127.0.0.1:8014${url.pathname}${url.search}`});
  await route.fulfill({response});
});
await context.route('**/api/v1/workspace/operations',async route => {
  const command = route.request().postDataJSON();
  assert.notEqual(command.kind,'message');
  const response = await route.fetch();
  const data = await response.json();
  operations.push({command,response:data});
  if (holdMove && command.args?.action?.kind === 'move_course_in_plan') {
    holdMove=false; notifySaved(); await moveRelease;
  }
  await route.fulfill({response}).catch(() => {}); // Navigation can abandon the deliberately held response.
});
const ready = page => page.waitForFunction(() => document.querySelector('.persistence-content')?.disabled === false);
const session = page => page.evaluate(() => {
  const entry = Object.entries(sessionStorage).find(([key])=>key.startsWith('course-radar-chat-session-v1:guest:'));
  return entry ? JSON.parse(entry[1]) : null;
});
const workspace = page => page.evaluate(async () => (await fetch('/api/v1/workspace',{headers:{Authorization:`Bearer ${localStorage.getItem('course-radar-workspace-credential-v1')}`}})).json());
const openChat = async page => { await page.getByLabel('Message Course Radar',{exact:true}).click(); };
async function send(page,text,expected) {
  const count = await page.locator('.cr-chat-turn').count();
  await page.getByLabel('Message Course Radar',{exact:true}).fill(text);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.waitForFunction(n=>document.querySelectorAll('.cr-chat-turn').length>n,count);
  await page.locator('.cr-chat-turn').last().getByText(expected).waitFor({state:'attached',timeout:45000});
  await ready(page);
}
let page = await context.newPage();
context.on('page', tab => tab.on('pageerror',error=>errors.push(error.message)));
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(base+'/planner'); await ready(page);
  await send(page,'Add CMPE 131 to my current semester',/starting academic term/i);
  const originalThread = (await session(page)).threadId;
  await page.goto(base+'/overview'); await ready(page); await openChat(page);
  await page.locator('.cr-chat-turn').last().getByText(/starting academic term/i).waitFor();
  await send(page,'Fall 2025',/Added CMPE 131/);
  await page.waitForURL('**/planner?semester=3'); await ready(page);
  assert.equal((await session(page)).threadId,originalThread);
  assert.equal(messages[0].thread_id,messages[1].thread_id);
  assert.ok(!(await page.locator('.cr-chat-messages').textContent()).includes('Calendar verified'));
  results.push('PASS clarification and agent thread survive cross-document navigation; add saves before acknowledgement');
  await page.goto(base+'/'); await ready(page); assert.equal(await page.locator('.cr-chat-widget').count(),0);
  await page.goto(base+'/roadmap'); await ready(page); await openChat(page);
  await page.locator('.cr-chat-turn').last().getByText(/Added CMPE 131/).waitFor();
  await page.reload(); await ready(page); await openChat(page);
  assert.equal((await session(page)).threadId,originalThread);
  await page.locator('.cr-chat-turn').last().getByText(/Added CMPE 131/).waitFor();
  results.push('PASS landing, Roadmap and refresh keep chat content and thread');
  const second = await context.newPage(); await second.goto(base+'/planner'); await ready(second);
  assert.deepEqual((await session(second)).items,[]);
  assert.notEqual((await session(second)).threadId,originalThread); await second.close();
  const popupEvent = context.waitForEvent('page');
  await page.evaluate(()=>window.open('/planner','_blank'));
  const popup = await popupEvent; await popup.waitForLoadState(); await ready(popup);
  await popup.waitForFunction(() => {
    const entry=Object.entries(sessionStorage).find(([k])=>k.startsWith('course-radar-chat-session-v1:guest:'));
    return entry && JSON.parse(entry[1]).items.length===0;
  });
  assert.notEqual((await session(popup)).threadId,originalThread);
  assert.equal((await session(page)).threadId,originalThread); await popup.close();
  results.push('PASS separate tabs and opener-created tabs start independent conversations');
  holdMove=true;
  await page.getByLabel('Message Course Radar',{exact:true}).fill('Move CMPE 131 to next semester');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await moveSaved;
  await page.reload(); await ready(page); releaseMove(); await openChat(page);
  await page.locator('.cr-chat-turn').last().getByText(/Moved CMPE 131/).waitFor({timeout:45000});
  assert.ok(operations.some(({command,response})=>command.args?.action?.kind==='move_course_in_plan' && response.replayed));
  let saved = await workspace(page);
  const program = saved.state.program, course = saved.state.catalog.courses.find(c=>c.code==='CMPE 131').id;
  assert.equal(saved.state.plans[program][course].semester,4);
  assert.deepEqual(saved.state.messages,{});
  results.push('PASS refresh after database save replays the durable action receipt without repeating the move');
  await send(page,'Show existing error',expectedError);
  await mkdir('tmp/chat-session',{recursive:true});
  await page.screenshot({path:'tmp/chat-session/desktop.png'});
  await page.close();
  page = await context.newPage(); await page.goto(base+'/planner'); await ready(page);
  assert.deepEqual((await session(page)).items,[]);
  saved=await workspace(page);
  assert.equal(saved.state.plans[program][course].semester,4);
  assert.equal(saved.state.startingTerms[program],'fall-2025');
  assert.deepEqual(saved.state.messages,{});
  results.push('PASS closing/reopening resets chat while keeping saved plan/profile; existing error text unchanged');
  assert.deepEqual(errors,[]);
} finally {
  releaseMove();
  await mkdir('tmp/chat-session',{recursive:true});
  await writeFile('tmp/chat-session/browser-results.json',JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors})); await browser.close();
}
