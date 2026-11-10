import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore } from "../src/planning-engine";
import { syncPlan, termFor, type CalendarData } from "../src/schedule-sync";
import { applyManual } from "../src/workspace.service";
import type { CourseOffering, ProgramCatalog } from "../src/course-types";

const offer = (classNumber: string, component: string): CourseOffering => ({ classNumber, component, courseCode: "CMPE 131", sectionNumber: classNumber, days: "MW", times: "09:00AM-10:15AM", instructors: ["Fixture"], location: "ENG", mode: "In Person", dates: "", openSeats: 10 });
function setup() {
  const year = new Date().getFullYear();
  const start = `spring-${year - 1}`;
  const fall = `fall-${year}`, spring = `spring-${year + 1}`;
  const offerings = [offer("1", "LEC"), offer("2", "LAB")];
  const catalog = { catalogYear: `${year}-${year + 1}`, currentTerm: { id: fall }, offerings, courses: [{ id: "course", code: "CMPE 131" }], requirementGroups: Array(8).fill({}) } as ProgramCatalog;
  const store = new PlanningStore("computer-engineering", catalog);
  store.restore({ ...store.getState(), startingTerms: { "computer-engineering": start } });
  const calendar: CalendarData = { status: "verified", as_of: `${year}-01-01`, valid_until: `${year}-12-31`, current_term: { season: "fall", year }, next_term: { season: "spring", year: year + 1 } };
  const run = (args: any, sections = { term: args.term, status: "available", offerings }) => syncPlan(store, args, calendar, sections, undefined, (kind, payload) => applyManual(store, kind, payload, {}));
  const scope = (term: string) => `computer-engineering:${catalog.catalogYear}:${term}`;
  return { store, run, scope, fall, spring, start, offerings, calendar };
}
test("planner and all required components commit together, with snapshots for reload", () => {
  const { store, run, scope, fall } = setup();
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: ["1", "2"] });
  assert.equal(store.plans.course.semester, 4);
  assert.deepEqual(store.getState().schedules[scope(fall)], ["1", "2"]);
  assert.equal(store.getState().scheduleOfferings?.[scope(fall)]?.length, 2);
});
test("incomplete, forged and wrong-term sections fail before changing the planner", () => {
  for (const selected of [["1"], ["1", "forged"], ["1", "1"]]) {
    const { store, run, fall } = setup(), before = structuredClone(store.getState());
    assert.throws(() => run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected }));
    assert.deepEqual(store.getState(), before);
  }
  const { store, run, spring } = setup();
  assert.throws(() => run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: spring, selected: ["1", "2"] }));
  assert.deepEqual(store.plans, {});
});
test("moving to next or distant term clears old selections; removals clear destination", () => {
  const { store, run, scope, fall, spring } = setup();
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: ["1", "2"] });
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 5 }, term: spring, selected: ["1", "2"] });
  assert.deepEqual(store.getState().schedules[scope(fall)], []);
  assert.deepEqual(store.getState().schedules[scope(spring)], ["1", "2"]);
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 8 }, selected: [] });
  assert.deepEqual(store.getState().schedules[scope(spring)], []);
  run({ baseKind: "removePlan", baseArgs: { id: "course" }, selected: [] });
  assert.deepEqual(store.plans, {});
});
test("last section removal removes the planner entry, partial removal keeps it", () => {
  const { store, run, scope, fall } = setup();
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: ["1", "2"] });
  run({ baseKind: "removeSection", baseArgs: { id: "course", classNumber: "2" }, term: fall });
  assert.equal(store.plans.course.semester, 4);
  run({ baseKind: "removeSection", baseArgs: { id: "course", classNumber: "1" }, term: fall });
  assert.deepEqual(store.plans, {});
  assert.deepEqual(store.getState().schedules[scope(fall)], []);
});
test("unpublished sections retain a plan with no fabricated meetings", () => {
  const { store, run, scope, fall } = setup();
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: [] }, { term: fall, status: "unavailable", offerings: [] });
  assert.equal(store.plans.course.semester, 4);
  assert.deepEqual(store.getState().schedules[scope(fall)], []);
});
test("account profile wins over a conflicting workspace starting term", () => {
  const { store, calendar, fall, offerings } = setup();
  assert.throws(() => syncPlan(store, { baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: ["1", "2"] }, calendar, { term: fall, status: "available", offerings }, `spring-${new Date().getFullYear()}`, () => assert.fail("must validate before applying")));
  assert.equal(termFor("spring-2025", 4), "fall-2026");
});


test("current-term planning needs no section selection; moves clear old meetings", () => {
  const { store, run, scope, fall } = setup();
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, selected: [] });
  assert.equal(store.plans.course.semester, 4);
  assert.deepEqual(store.getState().schedules, {});
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4 }, term: fall, selected: ["1", "2"] });
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 4, status: "in-progress" }, selected: [] });
  assert.deepEqual(store.getState().schedules[scope(fall)], ["1", "2"]);
  run({ baseKind: "setPlan", baseArgs: { id: "course", semester: 5 }, selected: [] });
  assert.equal(store.plans.course.semester, 5);
  assert.deepEqual(store.getState().schedules[scope(fall)], []);
});
