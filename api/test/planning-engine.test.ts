import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore, parseActions, findCourses, planningWarnings } from "../src/planning-engine";

const course = (id, title = id) => ({ id, code: id.toUpperCase().replace("-", " "), title, units: 3, prerequisiteCourseIds: [], corequisiteCourseIds: [], sourceUrl: "https://catalog.sjsu.edu/" });
const catalog = { courses: [course("cmpe-120", "Computer organization"), course("cmpe-121", "Computer design")], requirementGroups: [{}, {}, {}], currentTerm: { name: "Fall 2026" }, offerings: [] };
function setup() { return new PlanningStore("computer-engineering", catalog); }
function proposal(store, operation = "add", course = "CMPE 120", target = "Semester 1", id = crypto.randomUUID()) {
  return { requestId: id, revision: store.getState().revision, program: store.getState().program, selectedCourseId: null, actions: [{ operation, course, target: operation === "remove" ? null : target }] };
}

test("reordered database plan fields do not repeat an unchanged edit", () => {
  const store = setup();
  const saved = store.getState();
  store.restore({ ...saved, plans: { [saved.program]: { "cmpe-120": { status: "planned", semester: 1 } } } });
  const revision = store.getState().revision;
  assert.equal(store.apply(proposal(store)).status, "unchanged");
  assert.equal(store.getState().revision, revision);
});
test("clear add, move, remove, undo share the manual plan and retain status", () => {
  const store = setup();
  let result = store.apply(proposal(store));
  assert.equal(result.status, "success"); assert.equal(store.plans["cmpe-120"].semester, 1);
  store.setPlan("cmpe-120", 1, "in-progress");
  result = store.apply(proposal(store, "move", "CMPE 120", "Semester 2"));
  assert.deepEqual(store.plans["cmpe-120"], { semester: 2, status: "in-progress" });
  assert.equal(store.undo(result.edits, result.revision).status, "success");
  assert.equal(store.plans["cmpe-120"].semester, 1);
  result = store.apply(proposal(store, "remove"));
  assert.equal(store.plans["cmpe-120"], undefined);
  assert.equal(store.undo(result.edits, result.revision).status, "success");
  assert.equal(store.plans["cmpe-120"].semester, 1);
});
test("term mapping is explicit, unique, per program and validates semesters", () => {
  const store = setup();
  assert.match(store.apply(proposal(store, "add", "CMPE 120", "Fall 2026")).message, /Which semester/);
  assert.deepEqual(store.plans, {});
  store.setTerm(2, "Fall 2026");
  assert.throws(() => store.setTerm(1, "Fall 2026"));
  assert.equal(store.apply(proposal(store, "add", "CMPE 120", "Fall 2026")).status, "success");
  assert.equal(store.plans["cmpe-120"].semester, 2);
  store.selectProgram("software-engineering", catalog); assert.deepEqual(store.terms, {});
  assert.equal(store.apply(proposal(store, "add", "CMPE 120", "Semester 99")).status, "error");
  store.setTerm(1, "");
  assert.equal(store.apply(proposal(store, "add", "CMPE 120", "???")).status, "error");
});
test("ambiguous course, unknown course and unresolved this course never mutate", () => {
  const store = setup();
  for (const name of ["computer", "NOPE 999", "this course"]) {
    assert.equal(store.apply(proposal(store, "add", name)).status, "error");
    assert.deepEqual(store.plans, {});
  }
  const p = proposal(store, "add", "this course"); p.selectedCourseId = "cmpe-120";
  assert.equal(store.apply(p).status, "success");
  assert.equal(findCourses(catalog.courses, "CMPE 120").length, 1);
});
test("completed courses are protected and duplicate calls are idempotent", () => {
  const store = setup(); store.toggleTakenCourse("cmpe-120");
  assert.equal(store.apply(proposal(store)).status, "error");
  assert.deepEqual(store.getState().completed, ["cmpe-120"]);
  store.toggleTakenCourse("cmpe-120"); const p = proposal(store);
  assert.equal(store.apply(p).status, "success");
  const revision = store.getState().revision;
  assert.equal(store.apply(p).status, "unchanged"); assert.equal(store.getState().revision, revision);
  assert.equal(store.apply({ ...p, actions: [{ operation: "remove", course: "CMPE 120", target: null }] }).status, "error");
  assert.equal(store.apply(proposal(store)).status, "unchanged");
});
test("add conflict and multi-course/bulk changes require review with no partial mutation", () => {
  const store = setup(); store.setPlan("cmpe-120", 1);
  const conflict = proposal(store, "add", "CMPE 120", "Semester 2");
  assert.equal(store.apply(conflict).status, "review"); assert.equal(store.plans["cmpe-120"].semester, 1);
  assert.equal(store.apply(conflict, true).status, "success");
  const bulk = proposal(store, "remove"); bulk.actions.push({ operation: "add", course: "CMPE 121", target: "Semester 2" });
  assert.equal(store.apply(bulk).status, "review"); assert.equal(store.plans["cmpe-120"].semester, 2);
  assert.equal(store.apply(bulk, true).status, "success");
  const invalid = proposal(store); invalid.actions.push({ operation: "add", course: "UNKNOWN", target: "Semester 1" });
  const before = JSON.stringify(store.plans);
  assert.equal(store.apply(invalid, true).status, "error"); assert.equal(JSON.stringify(store.plans), before);
});
test("manual, completion, term, program away/back, catalog changes reject stale actions and undo", () => {
  for (const mutate of [s => s.setPlan("cmpe-121", 2), s => s.toggleTakenCourse("cmpe-121"), s => s.setTerm(1, "Fall 2026"), s => { s.selectProgram("software-engineering", catalog); s.selectProgram("computer-engineering", catalog); }, s => s.setCatalog(catalog)]) {
    const store = setup(), p = proposal(store); mutate(store);
    assert.equal(store.apply(p).status, "error"); assert.equal(store.plans["cmpe-120"], undefined);
  }
  const store = setup(), result = store.apply(proposal(store)); store.setPlan("cmpe-121", 2);
  assert.equal(store.undo(result.edits, result.revision).status, "error"); assert.ok(store.plans["cmpe-120"]);
});
test("invalid arguments, unknown fields, repeated course and numeric targets fail closed", () => {
  const store = setup();
  for (const actions of [null, [], [{}], [{ operation: "complete", course: "CMPE 120", target: null }], [{ operation: "add", course: "CMPE 120", target: 1 }], [{ operation: "add", course: "CMPE 120", target: "Semester 1", status: "completed" }]]) {
    assert.throws(() => parseActions(actions));
    assert.equal(store.apply({ ...proposal(store), actions }).status, "error");
    assert.deepEqual(store.plans, {});
  }
  const p = proposal(store); p.actions.push(p.actions[0]); assert.equal(store.apply(p, true).status, "error");
  assert.throws(() => store.setPlan("UNKNOWN", 1)); assert.throws(() => store.setPlan("cmpe-120", NaN));
});
test("warnings remain available and semester extension/removal preserves drafts", () => {
  const store = setup(); store.addSemester(); store.setTerm(4, "Spring 2027"); store.setPlan("cmpe-120", 4);
  store.removeLastSemester(); assert.equal(store.semesterCount, 4);
  store.removePlan("cmpe-120"); store.removeLastSemester(); assert.equal(store.semesterCount, 3); assert.equal(store.terms[4], undefined);
  const c = { ...catalog.courses[0], prerequisiteCourseIds: ["cmpe-121"] };
  assert.match(planningWarnings(c, 1, catalog, {}, new Set(), {})[0], /CMPE 121/);
  assert.match(planningWarnings(c, 1, catalog, {}, new Set(), { 1: "Fall 2026" }).join(), /No listed sections/);
});
