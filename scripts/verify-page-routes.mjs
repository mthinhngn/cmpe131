import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base = 'http://localhost:5175';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function ready(path, expected, label) {
  await page.goto(base + path);
  await page.waitForURL(url => url.pathname === expected, { timeout: 90000 });
  await page.getByRole('navigation', { name: 'Product navigation' }).getByRole('link', { name: label, exact: true }).waitFor();
  await page.locator('.persistence-content:not([disabled])').waitFor({ timeout: 90000 });
  await page.locator('.cr-page-loading').waitFor({ state: 'detached', timeout: 90000 });
  assert.equal(await page.getByRole('navigation', { name: 'Product navigation' }).getByRole('link', { name: label, exact: true }).getAttribute('aria-current'), 'page');
  assert.match(await page.locator('h1').first().textContent(), new RegExp(label));
}
try {
  await page.goto(base);
  const preview = page.frameLocator('#map').frameLocator('iframe');
  await page.locator('html.landed').waitFor({ timeout: 90000 });
  for (const id of ['schedule', 'planner', 'roadmap', 'overview']) {
    await page.getByRole('tab', { name: new RegExp(`^${id}$`, 'i') }).click();
    await preview.locator(`.sx-page[data-id="${id}"][aria-hidden="false"]`).waitFor();
  }
  for (const asset of ['base.css', 'base.js']) {
    const response = await page.request.get(`${base}/showcase/${asset}`);
    assert.equal(response.status(), 200);
    assert(!response.headers()['content-type'].includes('text/html'));
  }
  await ready('/overview', '/overview', 'Overview');
  await ready('/planner', '/planner', 'Planner');
  await page.goto(base + '/account');
  await page.getByRole("button", { name: "Continue with Google", exact: true }).waitFor({ timeout: 90000 });
  console.log('PASS Home preview controls/assets, Overview, Planner and Account');

  await ready('/roadmap', '/roadmap', 'Roadmap');
  assert.match(await page.title(), /Roadmap/);
  await page.locator('.react-flow').waitFor();
  await page.reload();
  await page.locator('.react-flow').waitFor();
  assert.equal(new URL(page.url()).pathname, '/roadmap');

  await page.getByRole('navigation', { name: 'Product navigation' }).getByRole('link', { name: 'Schedule', exact: true }).click();
  await page.waitForURL(base + '/schedule');
  await page.locator('.workspace-explorer .cx-search').waitFor({ timeout: 90000 });
  await page.locator('.cr-page-loading').waitFor({ state: 'detached', timeout: 90000 });
  await page.getByLabel('Search courses by code or title', { exact: true }).fill('CMPE');
  await page.waitForURL(url => url.searchParams.get('q') === 'CMPE');
  await page.reload();
  await page.locator('.persistence-content:not([disabled])').waitFor({ timeout: 90000 });
  await page.locator('.cr-page-loading').waitFor({ state: 'detached', timeout: 90000 });
  assert.equal(await page.getByLabel('Search courses by code or title', { exact: true }).inputValue(), 'CMPE');
  assert.equal(new URL(page.url()).pathname, '/schedule');
  console.log('PASS canonical Roadmap/Schedule, active navigation, reload and search');

  for (const alias of ['/prerequisites', '/prerequisitite', '/prerequisite-chart', '/catalog-prerequisites', '/roadmap/']) {
    await ready(alias + '?route-check=1#map-workspace', '/roadmap', 'Roadmap');
    assert.equal(new URL(page.url()).search, '?route-check=1');
    assert.equal(new URL(page.url()).hash, '#map-workspace');
  }
  await ready('/courses/?q=CMPE#workspace-content', '/schedule', 'Schedule');
  assert.equal(new URL(page.url()).search, '?q=CMPE');
  assert.equal(new URL(page.url()).hash, '#workspace-content');
  assert.equal(await page.getByLabel('Search courses by code or title', { exact: true }).inputValue(), 'CMPE');
  await ready('/schedule/', '/schedule', 'Schedule');
  await ready('/prerequisites?v=t2a&route-check=1', '/roadmap', 'Roadmap');
  assert.equal(new URL(page.url()).search, '?route-check=1');
  console.log('PASS legacy URLs, trailing slashes, query filters and anchors');
  assert.deepEqual(errors, []);
  console.log('PASS no browser runtime errors');
} catch (error) {
  console.error('Route check failed at', page.url());
  throw error;
} finally { await browser.close(); }
