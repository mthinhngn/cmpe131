import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore } from "../src/planning-engine";
import { applyManual } from "../src/workspace.service";
import type { ProgramCatalog } from "../src/course-types";

const program = "computer-engineering";
const catalog = {
  catalogYear: "2026-2027", currentTerm: { id: "fall-2026" },
  courses: [{ id: "a", code: "A 1" }, { id: "b", code: "B 1" }],
  requirementGroups: Array(8).fill({}), offerings: [],
} as unknown as ProgramCatalog;

test("completion without a plan and removing completed placements survive restore", () => {
  const store = new PlanningStore(program, catalog);
  applyManual(store, "toggleTakenCourse", { id: "a" }, {});
  assert.equal(store.plans.a, undefined);
  store.moveCompletedCourse("a", 2);
  applyManual(store, "removePlan", { id: "a" }, {});
  const restored = new PlanningStore(program, catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.equal(restored.plans.a, undefined);
  assert.deepEqual(restored.getState().completed, ["a"]);
});

test("marking complete and incomplete keeps the saved term and status", () => {
  const store = new PlanningStore(program, catalog);
  store.setPlan("a", 5, "in-progress");
  for (const completed of [true, false, true]) {
    applyManual(store, "toggleTakenCourse", { id: "a" }, {});
    assert.equal(store.getState().completed.includes("a"), completed);
    assert.deepEqual(store.plans.a, { semester: 5, status: "in-progress" });
  }
  store.moveCompletedCourse("a", "summer-2027");
  store.toggleTakenCourse("a");
  store.toggleTakenCourse("a");
  assert.equal(store.plans.a.semester, "summer-2027");
});

test("term names recalculate by position and completion stays with its column", () => {
  const store = new PlanningStore(program, catalog, ["b"]);
  store.setPlan("a", 3, "in-progress");
  store.moveCompletedCourse("b", 2);
  const before = store.getState(), scope = `${program}:2026-2027:`;
  store.restore({ ...before, startingTerms: { [program]: "fall-2026" }, schedules: { [`${scope}fall-2027`]: ["123"], [`${scope}spring-2030`]: ["456"] } });
  applyManual(store, "moveSemester", { from: 3, to: 1 }, {});
  assert.deepEqual(store.termOrder, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(store.plans.a, { semester: 1, status: "in-progress" });
  assert.equal(store.plans.b.semester, 3);
  assert.deepEqual(store.getState().completed, ["b"]);
  assert.equal(store.getState().schedules[`${scope}fall-2027`], undefined);
  assert.deepEqual(store.getState().schedules[`${scope}spring-2030`], ["456"]);
  const state = store.getState();
  assert.throws(() => store.moveSemester(0, 2));
  assert.equal(store.getState(), state);
  store.moveSemester(1, 1);
  assert.equal(store.getState(), state);
});

test("Summer year and all later dates recalculate and persist with course placements", () => {
  const store = new PlanningStore(program, catalog, ["b"]);
  store.addNamedTerm("summer-2027");
  store.setPlan("a", 4);
  store.moveCompletedCourse("b", "summer-2027");
  applyManual(store, "moveSemester", { from: "summer-2027", to: 4 }, {});
  assert.deepEqual(store.termOrder, [1, 2, 3, "summer-2028", 6, 7, 8, 9, 10]);
  assert.equal(store.plans.b.semester, "summer-2028");
  assert.equal(store.plans.a.semester, 6);
  assert.equal(store.terms[6], "Spring 2029");
  assert.deepEqual(store.getState().completed, ["b"]);
  assert.deepEqual(store.getState().namedTerms?.[program], ["summer-2028"]);
  const restored = new PlanningStore(program, catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.deepEqual(restored.termOrder, store.termOrder);
  assert.deepEqual(restored.plans, store.plans);
});

test("Winter renames by location and subsequent add/delete keep the corrected order", () => {
  const store = new PlanningStore(program, catalog);
  store.addNamedTerm("winter-2027");
  store.setPlan("a", "winter-2027");
  store.moveSemester("winter-2027", 2);
  assert.deepEqual(store.termOrder, [1, "winter-2027", 2, 3, 4, 5, 6, 7, 8]);
  store.moveSemester("winter-2027", 3);
  assert.deepEqual(store.termOrder, [1, 2, 3, "winter-2028", 4, 5, 6, 7, 8]);
  assert.equal(store.plans.a.semester, "winter-2028");
  store.addNamedTerm("summer-2030");store.removeSemester(4);
  assert.deepEqual(store.termOrder, [1, 2, 3, "winter-2028", 5, 6, 7, 8, "summer-2030"]);
});

test("completed course moves preserve completion, validate destinations and survive restore", () => {
  const store = new PlanningStore(program, catalog, ["a"]);
  const before = store.getState();
  for (const args of [{ id: "b", semester: 2 }, { id: "a", semester: 0 }, { id: "missing", semester: 2 }]) {
    assert.throws(() => applyManual(store, "moveCompletedCourse", args, {}));
    assert.equal(store.getState(), before);
  }
  applyManual(store, "removeSemester", { semester: 3 }, {});
  assert.throws(() => applyManual(store, "moveCompletedCourse", { id: "a", semester: 3 }, {}));
  applyManual(store, "moveCompletedCourse", { id: "a", semester: 4 }, {});
  assert.deepEqual(store.getState().completed, ["a"]);
  assert.equal(store.plans.a.semester, 4);
  applyManual(store, "moveCompletedCourse", { id: "a", semester: "winter-2027" }, {});
  const restored = new PlanningStore(program, catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.equal(restored.plans.a.semester, "winter-2027");
  assert.deepEqual(restored.getState().completed, ["a"]);
  assert.deepEqual(restored.getState().namedTerms?.[program], ["winter-2027"]);
  // Assistant proposals retain their protection against changing completed courses.
  assert.equal(restored.apply({ requestId: "completed", revision: restored.getState().revision, program,
    selectedCourseId: null, actions: [{ operation: "move", course: "A 1", target: "Semester 2" }] }).status, "error");
});

test("delete any populated term without shifting dates, completion or another program", () => {
  const store = new PlanningStore(program, catalog, ["b"]);
  store.setPlan("a", 3, "in-progress");
  const before = store.getState(), scope = `${program}:2026-2027:fall-2027`;
  store.restore({ ...before, startingTerms: { [program]: "fall-2026" },
    plans: { ...before.plans, "software-engineering": { a: { semester: 3, status: "planned" } } },
    schedules: { [scope]: ["123"], [`${program}:2026-2027:spring-2028`]: ["456"] },
    scheduleOfferings: { [scope]: [{ classNumber: "123", courseCode: "A 1" }] as any },
  });
  applyManual(store, "removeSemester", { semester: 3 }, {});
  assert.deepEqual(store.semesterSlots, [1, 2, 4, 5, 6, 7, 8]);
  assert.deepEqual(store.plans, {});
  assert.deepEqual(store.getState().completed, ["b"]);
  assert.equal(store.getState().plans["software-engineering"].a.semester, 3);
  assert.equal(store.getState().schedules[scope], undefined);
  assert.deepEqual(store.getState().schedules[`${program}:2026-2027:spring-2028`], ["456"]);
  assert.throws(() => store.setPlan("a", 3));
  const restored = new PlanningStore(program, catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.deepEqual(restored.semesterSlots, store.semesterSlots);
  for (const slot of [...restored.semesterSlots]) restored.removeSemester(slot);
  assert.equal(restored.semesterCount, 0);
  assert.deepEqual(restored.semesterSlots, []);
  restored.addSemester();
  assert.deepEqual(restored.semesterSlots, [9]);
});

test("empty Winter/Summer terms persist, accept courses and can be deleted", () => {
  const store = new PlanningStore(program, catalog);
  for (const term of ["winter-2027", "summer-2027"]) applyManual(store, "addNamedTerm", { term }, {});
  const restored = new PlanningStore(program, catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.deepEqual(restored.getState().namedTerms?.[program], ["winter-2027", "summer-2027"]);
  restored.setPlan("a", "winter-2027");
  applyManual(restored, "removeSemester", { semester: "winter-2027" }, {});
  assert.deepEqual(restored.plans, {});
  assert.deepEqual(restored.getState().namedTerms?.[program], ["summer-2027"]);
  const before = restored.getState();
  for (const semester of [0, 3.5, "winter-2027", null]) assert.throws(() => restored.removeSemester(semester as any));
  assert.throws(() => restored.addNamedTerm("winter-bogus"));
  assert.equal(restored.getState(), before);
});
