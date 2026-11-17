import test from 'node:test';
import assert from 'node:assert/strict';
import { saveTranscriptCourses, transcriptRowIssue } from '../src/transcript-client.ts';

const row = (id, status = 'completed', term = 'Fall 2025') => ({ row_id: id, course_id: id, code: id, status, term, needs_review: false });
const state = () => ({ program: 'ce', catalog: { courses: [{ id: 'a' }, { id: 'b' }] }, plans: {}, completed: ['manual'] });

test('selected completed and in-progress rows save in one operation with recorded terms', async () => {
  const saved = state(), calls = [];
  const store = { getState: () => saved, importTranscript: async rows => { calls.push(rows); saved.completed.push('a'); return { status: 'success' }; } };
  const result = await saveTranscriptCourses(store, { courses: [row('a'), row('b', 'in_progress', 'Spring 2026')] }, ['a', 'b'], 'fall-2025');
  assert.deepEqual(calls, [[{ course_id: 'a', term: 'fall-2025', status: 'completed' }, { course_id: 'b', term: 'spring-2026', status: 'in_progress' }]]);
  assert.deepEqual(result, ['manual', 'a']);
});

test('failed batch save cannot acknowledge a transcript import', async () => {
  const store = { getState: state, importTranscript: async () => ({ status: 'error', message: 'Save rejected' }) };
  await assert.rejects(saveTranscriptCourses(store, { courses: [row('a')] }, ['a'], 'fall-2025'), /Save rejected/);
});

test('review flags prevent invalid terms, repeats, transfers, and conflicting placements', async () => {
  for (const r of [row('a', 'transfer'), row('a', 'completed', 'Unknown'), { ...row('a'), needs_review: true }]) {
    assert.ok(transcriptRowIssue(r, { courses: [r] }, state(), 'fall-2025'));
  }
  assert.match(transcriptRowIssue(row('a'), { courses: [row('a'), row('a')] }), /Repeated/);
  const saved = state(); saved.plans.ce = { a: { semester: 2, status: 'planned' } };
  assert.match(transcriptRowIssue(row('a'), { courses: [row('a')] }, saved, 'fall-2025'), /another term/);
  let called = false;
  const store = { getState: () => saved, importTranscript: async () => { called = true; } };
  await assert.rejects(saveTranscriptCourses(store, { courses: [row('a')] }, ['a'], 'fall-2025'), /another term/);
  assert.equal(called, false);
});
