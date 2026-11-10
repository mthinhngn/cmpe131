import test from "node:test";
import assert from "node:assert/strict";
import { plannerPlacements } from "../src/plannerData.ts";

const courses = [
  { id: "core", recommendedSemester: 1 },
  { id: "elective", recommendedSemester: 0 },
  { id: "legacy-complete", recommendedSemester: 2 },
  { id: "unplanned", recommendedSemester: 1 },
];

test("both charts show saved electives and completions in their exact terms, without suggested courses", () => {
  const plans = { core: { semester: 3, status: "planned" }, elective: { semester: "summer-2027", status: "planned" } };
  const result = plannerPlacements(courses, plans, new Set(["core", "legacy-complete"]), [3, "summer-2027", 2]);
  assert.deepEqual(result.map(p => [p.course.id, p.semester, p.completed]), [
    ["core", 3, true], ["elective", "summer-2027", false],
  ]);
  assert.equal(result.some(p => p.course.id === "unplanned"), false);
});

test("deleted terms and other-program completion IDs cannot add chart blocks", () => {
  assert.deepEqual(plannerPlacements(courses, { core: { semester: 9, status: "planned" } }, new Set(["unknown", "legacy-complete"]), [1]), []);
  assert.deepEqual(plannerPlacements(courses, {}, new Set(), []), []);
});

test("completion alone never creates a placement, and removing a placement keeps completion independent", () => {
  const completed = new Set(["core"]);
  assert.deepEqual(plannerPlacements(courses, {}, completed, [1, 2]), []);
  assert.equal(plannerPlacements(courses, { core: { semester: 2, status: "planned" } }, completed, [1, 2])[0].semester, 2);
  assert.equal(completed.has("core"), true);
});
