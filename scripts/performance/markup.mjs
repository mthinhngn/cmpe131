import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CatalogProvider } from '../../src/CatalogContext.tsx';
import { ScheduleProvider } from '../../src/ScheduleContext.tsx';
import Current from '../../src/DegreeRoadmap.tsx';

const temporary = new URL('../../src/__performance_baseline.tsx', import.meta.url);
const source = await readFile(new URL('../../tmp/performance/baseline/DegreeRoadmap.tsx', import.meta.url), 'utf8');
// Same directory resolves the original component's imports without changing the checkout.
await writeFile(temporary, source, { flag: 'wx' });
try {
  const { default: Before } = await import(temporary.href);
  const render = Component => renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(CatalogProvider, null, createElement(ScheduleProvider, null, createElement(Component)))));
  const before = render(Before), after = render(Current);
  assert.equal(after, before);
  console.log(JSON.stringify({route:'/roadmap',initialMarkupIdentical:true,bytes:Buffer.byteLength(after),sha256:createHash('sha256').update(after).digest('hex')}));
} finally {
  await unlink(temporary);
}
