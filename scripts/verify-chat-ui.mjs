import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.addInitScript(()=>localStorage.setItem('course-radar-schedules-v1',JSON.stringify({schemaVersion:1,selectionsByScope:{}})));
 await page.goto('http://localhost:5175/planner');
 await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
 assert.equal(await page.getByRole('alert').count(),0);
 console.log('PASS cold Planner start imports legacy browser data before saving view');
 for(const path of ['/', '/overview', '/schedule', '/roadmap', '/planner']) {
  await page.goto(`http://localhost:5175${path}`);
  await page.getByLabel('Message Course Radar',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
  assert.ok(await page.locator('h1').count());
  await page.getByRole('button',{name:'Minimize chat',exact:true}).click();
  await page.getByRole('button',{name:/Chat with Course Radar/}).click();
  console.log(`PASS browser route ${path}, chat minimize/reopen`);
 }
 await page.getByRole('button',{name:'Edit Semester 2, 0 units',exact:true}).click();
 async function waitView(semester) {
  await page.waitForFunction(async semester=>{const c=localStorage.getItem('course-radar-workspace-credential-v1');const r=await fetch('/api/v1/workspace',{headers:{Authorization:`Bearer ${c}`}});const b=await r.json();return b.state.views[b.state.program]?.semester===semester},semester);
 }
 await waitView(2);
 await page.reload();
 await waitView(1);
 console.log('PASS chat semester context matches the visible planner after reload');
 await page.getByRole('button',{name:'All unplanned',exact:true}).click();
 await page.getByRole('button',{name:'Add CMPE 50 to Semester 1',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
 await page.getByRole('button',{name:'In Semester 1',exact:true}).click();
 await page.getByRole('button',{name:'Remove CMPE 50 from plan',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
 assert.equal(await page.getByRole('button',{name:'Remove CMPE 50 from plan',exact:true}).count(),0);
 console.log('PASS existing manual planner add/remove remains functional');
 await page.context().setOffline(true);
 await page.getByLabel('Message Course Radar',{exact:true}).fill('Search for CMPE 50');
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('alert').first().waitFor();
 console.log('PASS actual browser offline error:',await page.getByRole('alert').first().innerText());
 await page.context().setOffline(false);
 await page.getByRole('button',{name:'Retry save / connection',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.persistence-content')?.disabled===false);
 console.log('PASS retry recovers database connection without refresh');
 assert.deepEqual(errors,[]);
} finally {await browser.close()}
