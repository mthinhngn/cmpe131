import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore } from "../src/planning-engine";
import { applyAgentAction } from "../src/agent-action";
import { applyAgentSections } from "../src/agent-sections";
import type { ProgramCatalog, CourseOffering } from "../src/course-types";

const catalog = { catalogYear: "2026-2027", courses: [{ id: "a", code: "CMPE 131" }, { id: "b", code: "CMPE 142" }], requirementGroups: Array(8).fill({}) } as ProgramCatalog;
function fixture() {
  const store = new PlanningStore("computer-engineering", catalog);
  store.setPlan("a", 6); store.setPlan("b", 7, "in-progress");
  const expected_revision = JSON.stringify({ workspace_revision: store.getState().revision });
  const common = { action_id: "owned-action", tool_call_id: "tool", program_id: "computer-engineering", expected_revision };
  const action = { ...common, kind: "apply_plan_changes", operation: "swap", changes: [
    { ...common, kind: "move_course_in_plan", course_id: "a", course_code: "CMPE 131", previous_semester_slot: 6, previous_status: "planned", semester_slot: 7 },
    { ...common, kind: "move_course_in_plan", course_id: "b", course_code: "CMPE 142", previous_semester_slot: 7, previous_status: "in-progress", semester_slot: 6 }] };
  return { store, action };
}
test("Kimi swap commits both changes and keeps status and unrelated state", () => {
  const { store, action } = fixture(), before = structuredClone(store.getState());
  applyAgentAction(store, { action, browserFresh: true });
  assert.deepEqual(store.plans, { a: { semester: 7, status: "planned" }, b: { semester: 6, status: "in-progress" } });
  assert.deepEqual(store.getState().views, before.views);
  assert.equal(store.getState().revision, before.revision + 1);
});
test("a bad second swap step or stale workspace cannot partially apply", () => {
  for (const bad of ["source", "revision", "schedule"]) {
    const { store, action } = fixture();
    if (bad === "source") action.changes[1].previous_status = "planned";
    if (bad === "revision") action.expected_revision = JSON.stringify({ workspace_revision: -1 });
    if (bad === "schedule") store.restore({ ...store.getState(), schedules: { "computer-engineering:2026-2027:fall-2026": ["100"] } });
    const before = structuredClone(store.getState());
    assert.throws(() => applyAgentAction(store, { action, browserFresh: true }));
    assert.deepEqual(store.getState(), before);
  }
});
test("unrelated selected sections in the source semester do not block a swap", () => {
  const { store, action } = fixture();
  const key = "computer-engineering:2026-2027:fall-2026";
  const snapshots = { [key]: [section("CMPE 126", "other", "9:00AM-10:00AM")] };
  store.restore({ ...store.getState(), schedules: { [key]: ["other"] }, scheduleOfferings: snapshots });
  applyAgentAction(store, { action, browserFresh: true, profileStart: "spring-2024" });
  assert.equal(store.plans.a.semester, 7);
  assert.equal(store.plans.b.semester, 6);
  assert.deepEqual(store.getState().schedules, { [key]: ["other"] });
  assert.deepEqual(store.getState().scheduleOfferings, snapshots);
});
test("only selections for an affected course in its source term block a swap", () => {
  const { store, action } = fixture();
  const key = "computer-engineering:2026-2027:fall-2026";
  store.restore({ ...store.getState(), schedules: { [key]: ["selected"] }, scheduleOfferings: { [key]: [section("CMPE 131", "selected", "9:00AM-10:00AM")] } });
  const before = structuredClone(store.getState());
  assert.throws(() => applyAgentAction(store, { action, browserFresh: true, profileStart: "spring-2024" }), /CMPE 131 has a selected weekly section in fall-2026/);
  assert.deepEqual(store.getState(), before);
  // The same course's selection in a different term is not changed by this swap.
  applyAgentAction(store, { action, browserFresh: true, profileStart: "spring-2026" });
  assert.equal(store.plans.a.semester, 7);
  assert.deepEqual(store.getState().schedules, before.schedules);
});
test("replace accepts a null removal destination and preserves unrelated sections", () => {
  const { store, action } = fixture();
  store.restore({ ...store.getState(), catalog: { ...catalog, courses: [...catalog.courses, { id: "c", code: "CMPE 125" } as any] }, schedules: { "computer-engineering:2026-2027:fall-2026": ["other"] }, scheduleOfferings: { "computer-engineering:2026-2027:fall-2026": [section("CMPE 126", "other", "9:00AM-10:00AM")] } });
  const before = structuredClone(store.getState());
  const replacement = { ...action, operation: "replace", changes: [
    { ...action.changes[0], kind: "remove_course_from_plan", semester_slot: null },
    { ...action.changes[1], kind: "add_course_to_plan", course_id: "c", course_code: "CMPE 125", semester_slot: 6 }] };
  applyAgentAction(store, { action: replacement, browserFresh: true, profileStart: "spring-2024" });
  assert.equal(store.plans.a, undefined);
  assert.deepEqual(store.plans.c, { semester: 6, status: "planned" });
  assert.deepEqual(store.plans.b, before.plans[before.program].b);
  assert.deepEqual(store.getState().schedules, before.schedules);
  assert.deepEqual(store.getState().scheduleOfferings, before.scheduleOfferings);
});
const section = (code: string, classNumber: string, times: string) => ({ courseCode: code, classNumber, component: "LEC", days: "MW", times }) as CourseOffering;
test("Kimi sections preserve other courses and reject overlaps atomically", () => {
  const { store } = fixture();
  store.setPlan("a", 2);
  const key = "computer-engineering:2026-2027:fall-2026";
  store.restore({ ...store.getState(), startingTerms: { "computer-engineering": "spring-2026" }, schedules: { [key]: ["old", "other"] } });
  const data = { status: "available", term: "fall-2026", offerings: [section("CMPE 131", "old", "9:00AM-10:00AM"), section("CMPE 131", "new", "11:00AM-12:00PM"), section("CMPE 142", "other", "9:00AM-10:00AM")] };
  const action = { course_id: "a", program_id: "computer-engineering", expected_revision: JSON.stringify({ workspace_revision: store.getState().revision }), term: "fall-2026", class_numbers: ["old", "other"] };
  const before = structuredClone(store.getState());
  assert.throws(() => applyAgentSections(store, { action, browserFresh: true }, data), /overlap/);
  assert.deepEqual(store.getState(), before);
  action.class_numbers = ["new", "other"];
  applyAgentSections(store, { action, browserFresh: true }, data);
  assert.deepEqual(store.getState().schedules[key], ["new", "other"]);
  assert.equal(store.getState().scheduleOfferings?.[key].length, 2);
});
