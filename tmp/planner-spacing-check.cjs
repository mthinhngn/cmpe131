const { chromium } = require('C:/Users/thinh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1242, height: 668 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/planner');
  await page.locator('.sp-timeline').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Use recommended roadmap' }).click();
  await page.getByLabel('Dismiss notification').click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Add semester', exact: true }).click();
  await page.getByLabel('Dismiss notification').click();
  await page.getByRole('button', { name: /Edit Semester 1, / }).click();
  const metrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.sp-timeline > button')];
    const main = document.querySelector('.sp-main');
    const mainRect = main.getBoundingClientRect();
    const mainStyle = getComputedStyle(main);
    const overview = getComputedStyle(document.querySelector('.sp-overview'));
    return {
      padding: buttons.map(button => getComputedStyle(button).padding),
      widths: buttons.map(button => button.getBoundingClientRect().width),
      leftGutter: mainRect.left + parseFloat(mainStyle.paddingLeft),
      rightGutter: innerWidth - mainRect.right + parseFloat(mainStyle.paddingRight),
      background: overview.backgroundColor,
      bar: getComputedStyle(document.querySelector('.sp-bar-stack > span')).backgroundColor,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.equal(new Set(metrics.padding).size, 1);
  assert.equal(metrics.padding[0], '12px 14px 16px');
  assert.ok(Math.max(...metrics.widths) - Math.min(...metrics.widths) < 1);
  assert.equal(metrics.leftGutter, 32);
  assert.equal(metrics.rightGutter, 32);
  assert.equal(metrics.background, 'rgb(244, 244, 242)');
  assert.equal(metrics.pageOverflow, false);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '.impeccable/review/planner-spacing-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Edit Semester 10, / }).click();
  assert.equal(await page.getByRole('button', { name: 'In Semester 10', exact: true }).getAttribute('aria-pressed'), 'true');
  console.log(JSON.stringify({ result: 'PASS', ...metrics, errors }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
