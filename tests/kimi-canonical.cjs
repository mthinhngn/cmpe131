// Canonical desktop integration: a seeded test session and real workspace PostgreSQL.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
require('../api/node_modules/dotenv').config({path:path.resolve('api/.env'),quiet:true});
const { PrismaClient } = require('../api/generated/users');
let pw; try { pw=require('playwright'); } catch { pw=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
// The Planner hosts the assistant input inside its command bar; switch it to Ask before typing.
const askMode = async page => { const ask = page.getByRole('button', { name: 'Ask', exact: true }); if (await ask.count() && await ask.getAttribute('aria-pressed') !== 'true') await ask.click(); };
const db=new PrismaClient();
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const token=crypto.randomBytes(32).toString('hex'), workspaceKey=crypto.randomBytes(32).toString('hex');
const email=`kimi-test-${token.slice(0,12)}@example.com`, base='http://localhost:5175';
let user,browser;
(async()=>{
 try {
  user=await db.user.create({data:{email,workspaceKey,name:'Thinh Test',major:'computer-engineering',startingSemester:'Spring 2026'}});
  await db.session.create({data:{tokenHash:hash(token),userId:user.id,expiresAt:new Date(Date.now()+600000)}});
  browser=await pw.chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);
  page.on('response',r=>{if(r.url().includes('/workspace/operations') || r.url().endsWith('/action-results')) console.log('Action HTTP',r.status());if(r.status()>=400)console.error('HTTP',r.status(),r.url());});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')console.error('BROWSER:',m.text());});
  page.on('requestfailed',r=>console.error('NETWORK:',r.url(),r.failure()?.errorText));
  await page.context().addCookies([{name:'cr_session',value:token,url:base+'/api/v1',httpOnly:true,sameSite:'Lax'}]);
  await page.goto(base+'/account');
  await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
  console.log('Account verified.');
  await page.goto(base+'/planner');
  console.log('Signed in; loading canonical planner.');
  await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  assert.equal((await (await page.request.get(base+'/api/v1/auth/me')).json()).user.id,user.id);
  await askMode(page); await page.getByLabel('Message Course Radar',{exact:true}).click();
  await page.locator('.cr-chat-suggestions').getByRole('button').first().waitFor();
  // Opening the existing compact composer reveals suggestions; sending opens its conversation.
  const records=new Map();let lastReceipt;
  await page.route('**/api/v1/agent/messages',async route=>{
   const body=route.request().postDataJSON(),ctx=body.context;
   if(!body.message.startsWith('fixture ')) return route.continue();
   const courses=ctx.plan;
   let action;
   if(body.message==='fixture swap' || body.message==='fixture unrelated swap') {
    const pair=body.message==='fixture swap'?classes:unrelated;
    action={kind:'apply_plan_changes',operation:'swap',changes:pair.map((c,i)=>({kind:'move_course_in_plan',course_id:c.id,course_code:c.code,previous_semester_slot:courses.find(p=>p.course_id===c.id).semester_slot,previous_status:courses.find(p=>p.course_id===c.id).status,semester_slot:courses.find(p=>p.course_id===pair[1-i].id).semester_slot,action_id:crypto.randomUUID(),tool_call_id:crypto.randomUUID(),program_id:ctx.program_id,expected_revision:ctx.revision}))};
   } else if(body.message==='fixture unrelated replace') {
    const old=courses.find(p=>p.course_id===unrelated[0].id),common={action_id:crypto.randomUUID(),tool_call_id:crypto.randomUUID(),program_id:ctx.program_id,expected_revision:ctx.revision};
    action={kind:'apply_plan_changes',operation:'replace',changes:[{...common,kind:'remove_course_from_plan',course_id:unrelated[0].id,course_code:unrelated[0].code,previous_semester_slot:old.semester_slot,previous_status:old.status,semester_slot:null},{...common,kind:'add_course_to_plan',course_id:replacement.id,course_code:replacement.code,semester_slot:old.semester_slot}]};
   } else action={kind:'set_course_sections',course_id:classes[0].id,term:'fall-2026',class_numbers:bundle};
   action={...action,action_id:crypto.randomUUID(),tool_call_id:crypto.randomUUID(),program_id:ctx.program_id,expected_revision:ctx.revision};
   const record={request_id:body.request_id,status:'awaiting_action',reply:'',action,events:[],trace_id:'controlled'};records.set(body.request_id,record);await route.fulfill({json:record});
  });
  await page.route('**/api/v1/agent/requests/**',async route=>{
   const id=new URL(route.request().url()).pathname.split('/').at(-1);
   return records.has(id)?route.fulfill({json:records.get(id)}):route.continue();
  });
  await page.route('**/api/v1/agent/action-results',async route=>{
   const body=route.request().postDataJSON(),record=records.get(body.request_id);
   if(!record)return route.continue();
   lastReceipt=body;record.status=body.status==='succeeded'?'completed':'failed';record.reply=body.status==='succeeded'?'Fixture saved and verified.':body.message;record.action=null;await route.fulfill({json:record});
  });
  async function read(){return page.evaluate(async()=>{const me=await(await fetch('/api/v1/auth/me')).json();const r=await fetch('/api/v1/workspace',{headers:{'X-Workspace-User':me.user.id}});if(!r.ok)throw Error('Read '+r.status);return r.json();});}
  async function command(kind,args){const w=await read();return page.evaluate(async ({kind,args,version})=>{const me=await(await fetch('/api/v1/auth/me')).json();const r=await fetch('/api/v1/workspace/operations',{method:'POST',headers:{Origin:location.origin,'Content-Type':'application/json','X-Workspace-User':me.user.id},body:JSON.stringify({kind,args,version,requestId:crypto.randomUUID()})});const body=await r.json();if(!r.ok)throw Error(JSON.stringify(body));return body;},{kind,args,version:w.version});}
  async function send(text,expected){console.log('Sending:',text);const diagnostic=setTimeout(async()=>console.log('WAITING CHAT:',await page.locator('.cr-chat-widget').innerText().catch(()=>'')),20000);await askMode(page); await page.getByLabel('Message Course Radar',{exact:true}).fill(text);await page.getByLabel('Send message',{exact:true}).click();await page.waitForFunction(expected=>document.querySelector('.cr-chat-turn:last-of-type')?.textContent.includes(expected)||[...document.querySelectorAll('.cr-chat-turn')].at(-1)?.textContent.includes(expected)||!![...document.querySelectorAll('.cr-chat-turn')].at(-1)?.querySelector('.cr-chat-failed'),expected,{timeout:90000}).catch(async e=>{console.error('CHAT:',await page.locator('.cr-chat-widget').innerText());throw e;});clearTimeout(diagnostic);assert.ok((await page.locator('.cr-chat-turn').last().innerText()).includes(expected),'Expected acknowledgement: '+expected+'; received: '+await page.locator('.cr-chat-turn').last().innerText());console.log('Confirmed:',text);}
  if(process.argv.includes('--live')) {
   await send('hey Kimi','help');
   const reply=await page.locator('.cr-chat-turn').last().innerText();
   assert.match(reply,/Thinh/i);assert.match(reply,/plan|course|section/i);console.log('LIVE personalized Kimi greeting passed.');
  }
  const w=await read();const classes=['CMPE 131','CMPE 142'].map(code=>w.state.catalog.courses.find(c=>c.code===code));assert.ok(classes.every(Boolean));
  await command('setPlan',{id:classes[0].id,semester:6});await command('setPlan',{id:classes[1].id,semester:7,status:'in-progress'});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  await send('fixture swap','Fixture saved and verified.');assert.equal(lastReceipt.status,'succeeded');
  let saved=await read();assert.equal(saved.state.plans[saved.state.program][classes[0].id].semester,7);assert.equal(saved.state.plans[saved.state.program][classes[1].id].semester,6);
  await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  saved=await read();assert.equal(saved.state.plans[saved.state.program][classes[0].id].semester,7);
  const offers=await(await page.request.get(base+'/agent/schedule/sections?term=fall-2026')).json();
  const same=offers.offerings.filter(o=>o.courseCode==='CMPE 131');
  const bundle=[...new Set(same.map(o=>o.component))].map(component=>same.find(o=>o.component===component).classNumber);assert.ok(bundle.length);
  await command('setPlan',{id:classes[0].id,semester:2});await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  await send('fixture sections','Fixture saved and verified.');assert.equal(lastReceipt.status,'succeeded');
  saved=await read();assert.deepEqual([...saved.state.schedules[`${saved.state.program}:${saved.state.catalog.catalogYear}:fall-2026`]].sort(),[...bundle].sort());
  await page.screenshot({path:'tmp/kimi-canonical-desktop.png'});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  saved=await read();assert.deepEqual(saved.state.schedules[`${saved.state.program}:${saved.state.catalog.catalogYear}:fall-2026`],bundle);
  // Reproduce the reported failure with a real saved schedule belonging to a different course.
  const unrelated=['CMPE 50','MATH 33LA'].map(code=>saved.state.catalog.courses.find(c=>c.code===code));
  const replacement=saved.state.catalog.courses.find(c=>c.code==='CMPE 125');assert.ok(unrelated.every(Boolean)&&replacement);
  await command('setPlan',{id:unrelated[0].id,semester:2});await command('setPlan',{id:unrelated[1].id,semester:3});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  const beforeSwap=await read();
  if(process.argv.includes('--live-swap')) {
   let liveReceipt;
   const listener=request=>{if(request.url().endsWith('/api/v1/agent/action-results'))liveReceipt=request.postDataJSON();};
   page.on('request',listener);
   try { await send('swap math33LA with CMPE50','applied and verified'); }
   catch(error) { console.error('LIVE last turn:',await page.locator('.cr-chat-turn').last().innerText()); await page.screenshot({path:'tmp/kimi-live-swap-failure.png'}); throw error; }
   page.off('request',listener);assert.equal(liveReceipt.status,'succeeded');
   console.log('LIVE exact wording: swap math33LA with CMPE50 -> atomic action -> PostgreSQL -> verified acknowledgement.');
  } else {await send('fixture unrelated swap','Fixture saved and verified.');assert.equal(lastReceipt.status,'succeeded');}
  saved=await read();assert.equal(saved.state.plans[saved.state.program][unrelated[0].id].semester,3);assert.equal(saved.state.plans[saved.state.program][unrelated[1].id].semester,2);
  assert.deepEqual(saved.state.schedules,beforeSwap.state.schedules);assert.deepEqual(saved.state.scheduleOfferings,beforeSwap.state.scheduleOfferings);
  await send('fixture unrelated replace','Fixture saved and verified.');assert.equal(lastReceipt.status,'succeeded');
  saved=await read();assert.equal(saved.state.plans[saved.state.program][unrelated[0].id],undefined);assert.equal(saved.state.plans[saved.state.program][replacement.id].semester,3);
  assert.deepEqual(saved.state.schedules,beforeSwap.state.schedules);assert.deepEqual(saved.state.scheduleOfferings,beforeSwap.state.scheduleOfferings);
  await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  saved=await read();assert.deepEqual(saved.state.schedules,beforeSwap.state.schedules);assert.equal(saved.state.plans[saved.state.program][replacement.id].semester,3);
  console.log('REGRESSION: swap CMPE 50/MATH 33LA and replace CMPE 50/CMPE 125 preserve unrelated CMPE 131 sections and snapshots across reload.');
  if(process.argv.includes('--live') || process.argv.includes('--live-actions')) {
   await send('Remove CMPE 142 from my plan','Removed CMPE 142');saved=await read();assert.equal(saved.state.plans[saved.state.program][classes[1].id],undefined);await page.reload();await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);saved=await read();assert.equal(saved.state.plans[saved.state.program][classes[1].id],undefined);console.log('LIVE Kimi -> Course Action -> authenticated workspace save -> acknowledgement passed.');
  }
  await page.goto(base+'/account');await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('link',{name:'Sign in',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS canonical 5175: real sign-in, atomic swap, section save, reload and sign-out.');
 } finally {
  if(browser)await browser.close();
  if(user){const workspace=await db.personalWorkspace.findUnique({where:{tokenHash:hash(workspaceKey)}});if(workspace){await db.personalOperation.deleteMany({where:{workspaceId:workspace.id}});await db.personalWorkspace.delete({where:{id:workspace.id}});}await db.session.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}});
   execFileSync('python',['-c',"import sys; from agent_service.catalog import database_url; import psycopg; c=psycopg.connect(database_url()); c.execute('DELETE FROM kimi_memory WHERE owner=%s',(sys.argv[1],)); c.commit(); c.close()",'account:'+user.id]);}
  await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
