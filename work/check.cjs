const { chromium } = require('C:/Users/thinh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true, channel:"msedge"});
 const page=await browser.newPage();
 const findings=[];
 for(const width of [1920,1440,1280]){
  await page.setViewportSize({width,height:900}); await page.goto('http://localhost:5173/'); await page.waitForTimeout(3500); await page.evaluate(()=>document.fonts.ready);
  findings.push(await page.evaluate(()=>{const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};let h=document.querySelector('main>section'),copy=h.children[0],art=h.children[1];return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,hero:rect(h),copy:rect(copy),art:rect(art),cta:rect(copy.querySelector('a')),header:rect(document.querySelector('header')),nav:rect(document.querySelector('nav'))}}));
  await page.screenshot({path:`work/landing-${width}.png`});
 }
 await page.locator('#explore').scrollIntoViewIfNeeded();await page.waitForTimeout(800);await page.screenshot({path:'work/explore.png'});
 await page.getByRole('textbox',{name:'Search courses'}).fill('Calculus'); findings.push({search:await page.locator('#explore [role=status]').innerText(),results:await page.locator('#explore').innerText()});
 await page.getByRole('textbox',{name:'Search courses'}).fill('no-such-course');findings.push({empty:await page.locator('#explore [role=status]').innerText()});await page.getByRole('textbox',{name:'Search courses'}).fill('');
 await page.locator('#your-path').scrollIntoViewIfNeeded();await page.waitForTimeout(800);await page.locator('[data-course-id]').first().hover();findings.push({hoverActive:await page.locator('[data-active=true]').count(),muted:await page.locator('[data-muted=true]').count()});await page.screenshot({path:'work/path.png'});
 await page.locator('[data-course-id]').first().focus();findings.push({focus:await page.locator('[data-course-id]').first().evaluate(e=>({outline:getComputedStyle(e).outline,active:document.activeElement===e}))});
 await page.getByRole('button',{name:'Semester 3',exact:true}).click();findings.push({semester:await page.getByRole('button',{name:'Semester 3',exact:true}).getAttribute('aria-pressed')});await page.locator('#your-plan').evaluate(e=>window.scrollTo(0,e.offsetTop));await page.waitForTimeout(800);await page.screenshot({path:'work/plan.png'});
 await page.locator('#your-week').scrollIntoViewIfNeeded();await page.waitForTimeout(800);await page.screenshot({path:'work/week.png'});
 findings.push({meetings:await page.locator('[data-week-size] [title]').evaluateAll(es=>es.map(e=>({text:e.innerText,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]})))});
 await page.locator('header a[href="#your-plan"]').click(); findings.push({anchor:page.url()});
 fs.writeFileSync('work/checks.json',JSON.stringify(findings,null,2)); await browser.close();
})();

