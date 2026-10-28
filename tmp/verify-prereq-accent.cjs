const {chromium}=require('C:/Users/thinh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Users/thinh/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'});
 const p=await b.newPage({viewport:{width:1480,height:668},deviceScaleFactor:2});
 await p.goto('http://localhost:5174/prerequisite-chart');
 await p.locator('.course-node').first().waitFor({state:'attached'}); await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('.student-avatar').count(),0);
 assert.equal(await p.locator('.node-accent[clip-path]').count(),8);
 assert.equal(await p.locator('clipPath rect[rx="7"]').count(),8);
 const allClipped=await p.locator('.node-accent').evaluateAll(nodes=>nodes.every(n=>{const id=n.getAttribute('clip-path').slice(5,-1); return document.getElementById(id)?.firstElementChild?.getAttribute('width')==='148'}));
 assert.ok(allClipped);
 await p.locator('.course-node').first().hover();
 await p.screenshot({path:'.impeccable/review/prerequisite-map/accent-avatar-1480.png',fullPage:true});
 await p.locator('.course-node').first().screenshot({path:'.impeccable/review/prerequisite-map/accent-closeup.png'});
 await p.setViewportSize({width:390,height:844});
 assert.equal(await p.locator('.student-avatar').count(),0);
 await p.goto('http://localhost:5174/'); await p.locator('.course-node').first().waitFor({state:'attached'});
 assert.equal(await p.locator('.student-avatar').count(),1);
 assert.equal(await p.locator('.node-accent[clip-path]').count(),0);
 assert.equal(await p.locator('.node-surface').first().getAttribute('width'),'190');
 console.log('PASS: 8 compact accents clipped to rounded interiors, desktop/mobile avatar removed, landing default unchanged.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

