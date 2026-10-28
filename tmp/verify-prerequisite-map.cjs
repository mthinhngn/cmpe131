const { chromium } = require('C:/Users/thinh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const output = '.impeccable/review/prerequisite-map';
fs.mkdirSync(output, { recursive: true });
const browserPath = 'C:/Users/thinh/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
async function settle(page) {
  await page.locator('.radar-app').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
}
async function signature(page) {
  return page.locator('.desktop-prereq-map').evaluate(svg => [...svg.querySelectorAll('*')].filter(el => !el.closest('clipPath') && !el.matches('defs:has(clipPath)')).map(el => {
    const s = getComputedStyle(el);
    return { tag: el.tagName, attributes: [...el.attributes].filter(a => a.name !== 'clip-path').filter(a => !((el.matches('.node-surface,.node-accent') && a.name==='width') || (el.matches('.node-credits') && a.name==='x') || (el.matches('.node-divider') && a.name==='x2') || (el.matches('.graph-edge') && a.name==='d'))).map(a => [a.name,a.value]), text: el.children.length ? '' : el.textContent,
      style: Object.fromEntries(['fill','stroke','strokeWidth','opacity','fontFamily','fontSize','fontWeight','letterSpacing','filter'].map(k => [k,s[k]])) };
  }));
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const landing = await context.newPage();
  const page = await context.newPage();
  for (const p of [landing,page]) p.on('pageerror', e => errors.push(e.message));
  await landing.goto('http://localhost:5174/'); await settle(landing);
  await page.goto('http://localhost:5174/prerequisite-chart'); await settle(page);
  assert.deepEqual(await signature(page), await signature(landing), 'Shared SVG styles/topology match; compact card width and edge anchors are the explicit user override');
  assert.equal(await page.locator('.prereq-topline').count(),0);
  assert.equal(await page.locator('.prereq-heading p').count(),0);
  assert.equal(await page.locator('.prereq-heading h1').innerText(),'Prerequisite map');
  assert.equal(await page.locator('.node-surface').first().getAttribute('width'),'150');
  assert.equal(await landing.locator('.node-surface').first().getAttribute('width'),'190');
  await landing.screenshot({path:`${output}/landing-desktop.png`});
  await page.screenshot({path:`${output}/desktop.png`,fullPage:true});
  assert.equal(await page.locator('.radar-sidebar').isVisible(),true,'Export planning sidebar restored');
  assert.equal(await page.getByText('INTERACTIVE DEGREE PLAN',{exact:false}).count(),1);
  const width = await landing.locator('.hero-window-shell').evaluate(e=>e.getBoundingClientRect().width);
  await page.locator('.prereq-map-frame').evaluate((e,w)=>e.style.width=`${w + 214}px`,width);
  await landing.locator('.desktop-prereq-map').screenshot({path:`${output}/landing-chart.png`});
  await page.locator('.desktop-prereq-map').screenshot({path:`${output}/dedicated-chart.png`});
  const dimensions = {landing:await landing.locator('.desktop-prereq-map').boundingBox(),dedicated:await page.locator('.desktop-prereq-map').boundingBox()};
  assert.ok(Math.abs(dimensions.landing.width-dimensions.dedicated.width)<0.1);
  assert.ok(Math.abs(dimensions.landing.height-dimensions.dedicated.height)<0.1);
  await page.locator('.prereq-map-frame').evaluate(e=>e.style.removeProperty('width'));
  // Shared chart interactions: select, hover/focus, search, empty, list, zoom, term.
  await page.locator('.course-node').filter({hasText:'CS 201'}).click();
  assert.match(await page.locator('.detail-course').innerText(),/CS 201/);
  await page.locator('.course-node').filter({hasText:'CS 101'}).hover();
  assert.ok(await page.locator('.graph-edge.is-lit').count()>0);
  const math = page.locator('.course-node').filter({hasText:'MATH 152'});
  await math.focus(); await page.keyboard.press('Enter');
  assert.equal(await math.getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  assert.match(await page.locator('.desktop-prereq-map').getAttribute('style'),/1.1/);
  await page.getByRole('button',{name:'Reset map zoom'}).click();
  await page.getByRole('button',{name:'Select semester',exact:false}).click();
  await page.getByRole('button',{name:'Spring 2027',exact:true}).click();
  assert.match(await page.getByRole('button',{name:'Select semester',exact:false}).innerText(),/Spring 2027/);
  const search = page.getByRole('searchbox');
  await search.fill('Algorithms');
  assert.match(await page.locator('.detail-course').innerText(),/CS 301/);
  await page.getByRole('button',{name:'Course list',exact:false}).click();
  assert.equal(await page.locator('.course-list-row').count(),1);
  await search.fill('no-match-xyz');
  assert.match(await page.locator('.empty-search').innerText(),/No courses match/);
  await page.getByRole('button',{name:'Clear course search'}).click();
  assert.equal(await page.locator('.course-list-row').count(),8);
  await page.locator('.course-list-row').filter({hasText:'CS 340'}).click();
  assert.match(await page.locator('.detail-course').innerText(),/CS 340/);
  for (const size of [{width:1078,height:668},{width:900,height:1000},{width:820,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:844}]) {
    await page.setViewportSize(size);
    await page.goto('http://localhost:5174/prerequisite-chart'); await settle(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No document overflow at ${size.width}`);
    if(size.width<=820) {
      await page.getByRole('button',{name:'CS 201 4 credits In progress',exact:false}).click();
      assert.match(await page.locator('.detail-course').innerText(),/CS 201/);
    }
    if(size.width===390) {
      await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
      await page.getByRole('button',{name:'Open navigation menu'}).click();
      assert.equal(await page.getByRole('button',{name:'Close navigation menu'}).getAttribute('aria-expanded'),'true');
    }
    if(size.width===768) await page.screenshot({path:`${output}/tablet-768.png`,fullPage:true});
    if(size.width===1078) await page.screenshot({path:`${output}/user-1078.png`,fullPage:true});
    if(size.width===900) await page.screenshot({path:`${output}/tablet.png`,fullPage:true});
  }
  await page.goto('http://localhost:5174/prerequisites/'); await settle(page);
  assert.equal(await page.locator('h1').count(),1);
  await landing.locator('.primary-nav a').filter({hasText:'Explore the map'}).click();
  await landing.waitForURL('**/prerequisite-chart');
  await settle(landing);
  await page.goto('http://localhost:5174/catalog-prerequisites');
  await page.locator('.react-flow').waitFor();
  assert.ok(await page.locator('.react-flow__node').count()>8,'Existing catalog graph retained');
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(`${output}/verification.json`,JSON.stringify({svgGeometryAndStyles:'shared styles and topology identical; dedicated cards 150 vs landing 190 with centered edge anchors per user override',dimensions,viewports:[1440,1078,900,820,768,390,320],interactions:'passed',pageErrors:errors},null,2));
  console.log(JSON.stringify({result:'PASS',dimensions,output}));
  await browser.close();
})().catch(e=>{ console.error(e);process.exit(1) });
