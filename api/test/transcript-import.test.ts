import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore } from "../src/planning-engine";
import { importTranscript, transcriptTerm } from "../src/transcript-import";

const setup = () => new PlanningStore("ce", { courses: ["a", "b", "c"].map(id => ({ id })), requirementGroups: [{}, {}], offerings: [] } as any, ["manual"]);
test("import places recorded terms, extends regular terms, and adds optional terms atomically", () => {
  const store = setup();
  importTranscript(store, [
    { course_id: "a", term: "fall-2025", status: "completed" },
    { course_id: "b", term: "summer-2026", status: "completed" },
    { course_id: "c", term: "fall-2026", status: "in_progress" },
  ], "fall-2025");
  assert.deepEqual(store.plans, { a: { semester: 1, status: "planned" }, b: { semester: "summer-2026", status: "planned" }, c: { semester: 3, status: "in-progress" } });
  assert.deepEqual(store.getState().completed, ["manual", "a", "b"]);
  assert.deepEqual(store.termOrder, [1, 2, "summer-2026", 3]);
  const before = structuredClone(store.getState());
  importTranscript(store, [{ course_id: "a", term: "fall-2025", status: "completed" }], "fall-2025");
  assert.deepEqual(store.plans, before.plans.ce);
  assert.deepEqual(store.getState().completed, before.completed);
});
test("one conflict rejects the whole batch and preserves existing schedules and completions", () => {
  const store = setup(); store.setPlan("b", 2);
  const before = structuredClone(store.getState());
  assert.throws(() => importTranscript(store, [
    { course_id: "a", term: "fall-2025", status: "completed" },
    { course_id: "b", term: "fall-2025", status: "completed" },
  ], "fall-2025"), /another term/);
  assert.deepEqual(store.getState(), before);
});
test("a distant term creates intervening semesters without restoring unrelated deleted terms", () => {
  const store = setup();
  store.removeSemester(1);
  importTranscript(store, [{ course_id: "a", term: "fall-2027", status: "completed" }], "fall-2025");
  assert.deepEqual(store.semesterSlots, [2, 3, 4, 5]);
});
test("repeats, pre-profile terms, invalid courses and malformed rows cannot change saved state", () => {
  for (const rows of [
    [{ course_id: "a", term: "fall-2024", status: "completed" }],
    [{ course_id: "a", term: "fall-2025", status: "transfer" }],
    [{ course_id: "absent", term: "fall-2025", status: "completed" }],
    [null],
    [{ course_id: "a", term: "fall-2025", status: "completed" }, { course_id: "a", term: "spring-2026", status: "in_progress" }],
  ]) {
    const store = setup(), before = structuredClone(store.getState());
    assert.throws(() => importTranscript(store, rows as any, "fall-2025"));
    assert.deepEqual(store.getState(), before);
  }
  assert.equal(transcriptTerm("2025 Fall Semester"), "fall-2025");
  assert.equal(transcriptTerm("Fall 2025 / Spring 2026"), null);
});
