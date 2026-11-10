const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
// The Planner hosts the assistant input inside its command bar; switch it to Ask before typing.
const askMode = async page => { const ask = page.getByRole('button', { name: 'Ask', exact: true }); if (await ask.count() && await ask.getAttribute('aria-pressed') !== 'true') await ask.click(); };

(async () => {
 const browser = await pw.chromium.launch({channel:'msedge',headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.KIMI_UI_URL || 'http://127.0.0.1:5186';
 await page.addInitScript(()=>localStorage.setItem('course-radar-academic-profile-v1',JSON.stringify({startingTerm:'spring-2026'})));
 await page.route('**/api/v1/bootstrap*',async r=>{
   const catalog=await page.evaluate(async()=>{const m=await import('/src/data.ts');return m.computerEngineeringCatalog;});
   const response=await context.request.get('http://127.0.0.1:8006/agent/schedule/sections?term=fall-2026');
   catalog.offerings=(await response.json()).offerings;
   await r.fulfill({json:{catalog}});
 });
 let lastBody, lastReceipt, receipts=0;
 page.on('request',r=>{if(r.url().endsWith('/agent/messages'))lastBody=r.postDataJSON(); if(r.url().endsWith('/agent/action-results')){lastReceipt=r.postDataJSON();receipts++;}});
 await page.route('**/agent/schedule/terms',r=>r.fulfill({json:{status:'verified',current_term:{season:'fall',year:2026}}}));
 async function send(text, expected) {
   await askMode(page); await page.getByLabel('Message Course Radar',{exact:true}).fill(text);
   await page.getByLabel('Send message',{exact:true}).click();
   await page.waitForFunction(expected=>[...document.querySelectorAll('.cr-chat-turn')].at(-1)?.textContent.includes(expected),expected);
 }
 const timeline=n=>page.locator('.sp-timeline button').nth(n-1);
 async function add(code,semester) {
   await timeline(semester).click();
   await page.getByRole('button',{name:'All unplanned',exact:true}).click();
   await page.getByLabel(`Add ${code} to Semester ${semester}`,{exact:true}).click();
 }
 try {
   await Promise.all([page.waitForResponse(r=>r.url().endsWith('/agent/session') && r.ok()), page.goto(base+'/planner')]);
   await send('hello','Hello from Kimi.');
   assert.ok(lastBody.context.capabilities.includes('apply_plan_changes'));
   const style=await page.locator('.cr-chat-window').evaluate(el=>({background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontFamily}));
   await page.screenshot({path:'tmp/kimi-chat-desktop.png'});
   for(let i=0;i<3;i++) await send('use reddit for reviews','Reddit preference observed.');
   await page.reload();
   await askMode(page); await page.getByLabel('Message Course Radar',{exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.cr-chat-turn').length===4);
   await send('hello again','Hello from Kimi.');
   assert.equal(lastBody.preferences.source['reddit:prefer'].active,true);
   assert.equal(lastBody.history.length,8);
   await page.getByLabel('Minimize chat').click();
   await add('CMPE 131',6); await add('CMPE 142',7);
   await send('swap CMPE131 in 6 and CMPE142 in 7','applied and verified');
   assert.equal(lastReceipt.status,'succeeded');
   assert.equal(lastReceipt.context.plan.find(p=>p.course_id==='ce-cmpe131').semester_slot,7);
   assert.equal(lastReceipt.context.plan.find(p=>p.course_id==='ce-cmpe142').semester_slot,6);
   assert.equal(receipts,1);
   await page.getByLabel('Minimize chat').click();
   await timeline(6).click();
   await page.getByRole('button',{name:'In Semester 6',exact:true}).click();
   assert.equal(await page.getByLabel('Remove CMPE 142 from plan',{exact:true}).count(),1);
   // Refresh retains chat but must not restore/replay the memory-only plan.
   await page.reload(); await askMode(page); await page.getByLabel('Message Course Radar',{exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.cr-chat-messages')?.textContent.includes('applied and verified'));
   await page.waitForTimeout(1200); assert.equal(receipts,1);
   await page.getByLabel('Minimize chat').click();
   await add('CMPE 131',2);
   await page.locator('.cr-chat-section-choice fieldset').first().waitFor();
   await page.locator('.cr-chat-section-choice fieldset').first().locator('input').first().check();
   await page.getByRole('button',{name:'Confirm sections',exact:true}).click();
   await page.getByLabel('Choose course sections').waitFor({state:'detached'});
   await send('select section 91002 for CMPE131 in fall-2026','selection was applied and verified');
   assert.equal(lastReceipt.status,'succeeded');
   assert.deepEqual(lastReceipt.context.selected_sections['fall-2026'],['91002']);
   // Account namespaces are verified by the isolated test auth adapter, never supplied in message bodies.
   await context.addCookies([{name:'fixture_account',value:'alpha',url:base}]);
   await page.evaluate(()=>window.dispatchEvent(new Event('course-radar-auth-change')));
   await page.waitForFunction(()=>document.querySelectorAll('.cr-chat-turn').length===0);
   await send('hello account alpha','Hello from Kimi.');
   await context.addCookies([{name:'fixture_account',value:'beta',url:base}]);
   await page.evaluate(()=>window.dispatchEvent(new Event('course-radar-auth-change')));
   await page.waitForFunction(()=>document.querySelectorAll('.cr-chat-turn').length===0);
   await send('hello account beta','Hello from Kimi.');
   await context.clearCookies({name:'fixture_account'});
   await page.evaluate(()=>window.dispatchEvent(new Event('course-radar-auth-change')));
   await page.waitForFunction(()=>document.querySelector('.cr-chat-messages')?.textContent.includes('use reddit for reviews'));
   assert.equal(await page.getByText('hello account alpha',{exact:true}).count(),0);
   assert.equal(await page.getByText('hello account beta',{exact:true}).count(),0);
   assert.deepEqual(style,await page.locator('.cr-chat-window').evaluate(el=>({background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontFamily})));
   await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:'tmp/kimi-chat-mobile.png'});
   assert.deepEqual(errors,[]);
   console.log('PASS: real Kimi graph + browser swap, section change, memory, preferences, owner switching, and unchanged chat styles.');
 } catch (error) { await page.screenshot({path:'tmp/kimi-integration-failure.png'}); console.error((await page.locator('.cr-chat-messages').textContent()).slice(-1800)); throw error; }
 finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
