const pickTerm = async (page, title) => { await page.getByRole('button',{name:'Schedule semester',exact:true}).click(); await page.getByRole('option',{name:title,exact:true}).click(); };
const path = require('node:path');
const os = require('node:os');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const { chromium } = playwright;
const assert = require('node:assert/strict');
// The Planner hosts the assistant input inside its command bar; switch it to Ask before typing.
const askMode = async page => { const ask = page.getByRole('button', { name: 'Ask', exact: true }); if (await ask.count() && await ask.getAttribute('aria-pressed') !== 'true') await ask.click(); };
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 let unavailable=false, delayed=false, receipt, command, requestId;
 const spring=[{courseCode:'CMPE 131',sectionNumber:'01',classNumber:'91001',mode:'In Person',component:'LEC',days:'MW',times:'10:00AM-11:15AM',instructors:['Test Instructor'],location:'ENG 101',dates:'Spring 2027',openSeats:10},{courseCode:'CMPE 131',sectionNumber:'02',classNumber:'91002',mode:'In Person',component:'LEC',days:'TR',times:'1:00PM-2:15PM',instructors:['Other Instructor'],location:'ENG 102',dates:'Spring 2027',openSeats:0}];
 await page.addInitScript(()=>localStorage.setItem('course-radar-academic-profile-v1',JSON.stringify({startingTerm:'spring-2026'})));
 await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.route('**/agent/**', async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/health')) return r.fulfill({json:{model:'test',tracing:'not_configured'}});
  if(path.endsWith('/schedule/terms')) return r.fulfill({json:{status:'verified',current_term:{season:'fall',year:2026}}});
  if(path.endsWith('/schedule/sections')) { if(delayed) await new Promise(resolve=>setTimeout(resolve,800)); return r.fulfill({json:{term:new URL(r.request().url()).searchParams.get('term'),status:unavailable?'unavailable':'available',offerings:unavailable?[]:spring,message:''}}); }
  if(path.endsWith('/messages')) { const body=r.request().postDataJSON(); requestId=body.request_id;command={action_id:'test-'+Date.now(),tool_call_id:'tool',kind:'add_course_to_plan',course_id:'cmpe131',course_code:'CMPE 131',program_id:body.context.program_id,expected_revision:body.context.revision,semester_slot:2,target_term:{season:'fall',year:2026}};
    // Use the exact catalog ID, not a guessed one.
    command.course_id=await page.evaluate(async()=>{const m=await import('/src/data.ts');return m.computerEngineeringCatalog.courses.find(c=>c.code==='CMPE 131').id;});
    return r.fulfill({json:{request_id:requestId,status:'running',reply:'',action:null,events:[],trace_id:''}});
  }
  if(path.includes('/requests/')) return r.fulfill({json:{request_id:requestId,status:'awaiting_action',reply:'',action:command,events:[],trace_id:'',web_handoff:{current_term:{season:'fall',year:2026},citations:[]}}});
  if(path.endsWith('/action-results')) {receipt=r.request().postDataJSON(); return r.fulfill({json:{request_id:requestId,status:'completed',reply:receipt.status==='succeeded'?'Added CMPE 131.':receipt.message,action:null,events:[],trace_id:''}});}
  return r.fulfill({status:404,json:{}});
 });
 const timeline=n=>page.locator('.sp-timeline button').nth(n-1);
 async function add(code,semester) {await timeline(semester).click();await page.getByRole('button',{name:'All unplanned',exact:true}).click();await page.getByLabel(`Add ${code} to Semester ${semester}`,{exact:true}).click();}
 async function choose() {await page.getByLabel('Choose course sections').waitFor();await page.locator('.cr-chat-section-choice fieldset').first().waitFor();for(const group of await page.locator('.cr-chat-section-choice fieldset').all()) await group.locator('input').first().check();await page.getByRole('button',{name:'Confirm sections',exact:true}).click();await page.getByLabel('Choose course sections').waitFor({state:'detached'});}
 async function minimize(){if(await page.getByLabel('Minimize chat').isVisible()) await page.getByLabel('Minimize chat').click();}
 try {
  await page.goto('http://127.0.0.1:5173/planner');
  await add('CMPE 131',6); await page.getByRole('button',{name:'In Semester 6',exact:true}).click();
  assert.equal(await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).count(),1); assert.equal(await page.getByLabel('Choose course sections').count(),0);
  await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).click();
  await add('CMPE 131',2); await page.getByRole('button',{name:'Cancel change'}).click();await minimize();
  assert.equal(await page.getByLabel('Add CMPE 131 to Semester 2',{exact:true}).count(),1);
  await add('CMPE 131',2);await choose();await minimize();
  await page.getByRole('link',{name:'Schedule',exact:true}).click();
  assert.equal((await page.getByRole('button',{name:'Schedule semester',exact:true}).innerText()).trim(),'Fall 2026');
  assert.ok(await page.locator('.cx-saved-section').count()>0);
  await page.screenshot({path:'tmp/schedule-sync-fall.png'});
  await pickTerm(page, 'Spring 2027');
  await page.getByText('Section 01 LEC',{exact:false}).count();
  assert.equal(await page.locator('.cx-saved-section').count(),0);
  await page.getByRole('link',{name:'Planner',exact:true}).click(); await timeline(2).click();
  const card=page.locator('.sp-catalog-grid article').filter({hasText:'CMPE 131'});
  await card.dragTo(timeline(3)); await choose(); await minimize();
  await page.getByRole('link',{name:'Schedule',exact:true}).click();
  assert.equal((await page.getByRole('button',{name:'Schedule semester',exact:true}).innerText()).trim(),'Spring 2027');
  assert.equal(await page.locator('.cx-saved-section').count(),1);
  await pickTerm(page, 'Fall 2026'); assert.equal(await page.locator('.cx-saved-section').count(),0);
  await pickTerm(page, 'Spring 2027');
  await page.getByLabel('Remove CMPE 131 section 01 from schedule',{exact:true}).click();
  await page.getByRole('link',{name:'Planner',exact:true}).click(); await timeline(3).click();
  assert.equal(await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).count(),0);
  // Agent waits for the browser section transaction before acknowledging success.
  await askMode(page); await page.getByLabel('Message Course Radar').fill('Add CMPE 131 to current semester'); await page.getByLabel('Send message').click();
  await page.locator('.cr-chat-section-choice fieldset').first().waitFor();assert.equal(receipt,undefined);
  await choose();await page.waitForFunction(()=>document.querySelector('.cr-chat-messages')?.textContent.includes('Added CMPE 131.'));
  assert.equal(receipt.status,'succeeded'); await minimize();
  await timeline(2).click();await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).click();
  // Unavailable next-term sections retain the planner entry, with no invented meetings.
  unavailable=true;await page.reload(); await add('CMPE 131',3);
  await page.waitForFunction(()=>document.querySelector('.sp-feedback')?.textContent.includes('added'));
  await page.getByRole('link',{name:'Schedule',exact:true}).click();await pickTerm(page, 'Spring 2027');
  await page.getByRole('region',{name:'Courses awaiting sections'}).count();
  await page.locator('.cx-pending-courses').waitFor();assert.match(await page.locator('.cx-pending-courses').innerText(),/CMPE 131.*\n.*Sections unavailable/s);
  unavailable=false;await page.getByRole('button',{name:'Choose sections',exact:true}).click();await choose();await minimize();
  assert.equal(await page.locator('.cx-saved-section').count(),1);
  await page.screenshot({path:'tmp/schedule-sync-spring.png'});
  // Lecture/lab choices are completed together; partial removal stays visible.
  spring.push({...spring[0],classNumber:'91003',component:'LAB',sectionNumber:'03',days:'F',times:'10:00AM-11:00AM'});
  await page.getByRole('link',{name:'Planner',exact:true}).click();await timeline(3).click();await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).click();
  await page.reload();await add('CMPE 131',3);
  await page.locator('.cr-chat-section-choice fieldset').first().waitFor();
  assert.equal(await page.locator('.cr-chat-section-choice fieldset').count(),2);
  await page.locator('.cr-chat-section-choice fieldset').first().locator('input').first().check();
  assert.equal(await page.getByRole('button',{name:'Confirm sections',exact:true}).isDisabled(),true);
  await page.screenshot({path:'tmp/schedule-sync-section-chat.png'});
  await choose();await minimize();
  await page.getByRole('link',{name:'Schedule',exact:true}).click();await pickTerm(page, 'Spring 2027');
  assert.equal(await page.locator('.cx-saved-section').count(),2);
  await page.getByLabel('Remove CMPE 131 section 03 from schedule',{exact:true}).click();await page.locator('.cx-pending-courses').waitFor();
  assert.match(await page.locator('.cx-pending-courses').innerText(),/Choose required sections/);
  await page.getByLabel('Remove CMPE 131 section 01 from schedule',{exact:true}).click();
  await page.getByRole('link',{name:'Planner',exact:true}).click();await timeline(3).click();assert.equal(await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).count(),0);
  // Cancel while the section request is in flight: no delayed commit.
  await page.reload();delayed=true;await add('CMPE 131',3);await page.getByRole('button',{name:'Cancel change'}).click();await page.waitForTimeout(1000);await minimize();
  assert.equal(await page.getByLabel('Add CMPE 131 to Semester 3',{exact:true}).count(),1);
  // A stale choice cannot apply to another degree program.
  delayed=false;await add('CMPE 131',3);await page.locator('.cr-chat-section-choice fieldset').first().waitFor();await page.goto('http://localhost:5175/account');await page.getByRole('button',{name:'Degree program',exact:true}).click();await page.getByRole('combobox',{name:'Search degree program',exact:true}).fill('Software Engineering');await page.getByRole('option',{name:/Software Engineering/}).click();await page.getByRole('button',{name:'Save guest settings',exact:true}).click();await page.getByText('Guest workspace saved.',{exact:true}).waitFor();await page.goto('http://localhost:5175/planner');
  await page.getByLabel('Choose course sections').waitFor({state:'detached'});await minimize();assert.equal(await page.getByLabel('Remove CMPE 131 from plan',{exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});await askMode(page); await page.getByLabel('Message Course Radar').focus();await page.screenshot({path:'tmp/schedule-sync-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS: long-range planner-only, cancel, manual add, term switching, move, reverse remove, agent acknowledgement, unavailable/retry.');
 } catch(e){await page.screenshot({path:'tmp/schedule-sync-failure.png'});throw e;} finally{await browser.close();}
})();
