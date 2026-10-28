import test from "node:test";
import assert from "node:assert/strict";
import { overviewData } from "../src/overviewData.ts";

const course = (id, units, recommendedSemester = 1) => ({ id, units, recommendedSemester, code: id });
const catalog = {
  courses: [course("A", 4), course("B", 3, 2), course("C", 2), course("outside-program", 9)],
  requirementGroups: [{ items: [{ courseId: "A" }, { courseId: "A" }, { courseId: "B" }, { courseId: "C" }, { label: "Elective choice" }] }],
};

test("new overview does not invent completion or enrollment", () => {
  const result = overviewData(catalog, new Set(), {});
  assert.equal(result.percent, 0);
  assert.equal(result.activeUnits, 0);
  assert.equal(result.completedUnits, 0);
  assert.equal(result.required.length, 3);
  assert.equal(result.coreUnits, 9);
  assert.deepEqual(result.upcoming.map(course => course.id), ["A", "C", "B"]);
});

test("completion takes priority over an old plan and ignores other-program courses", () => {
  const result = overviewData(catalog, new Set(["A", "outside-program"]), {
    A: { semester: 1, status: "planned" }, B: { semester: 2, status: "in-progress" },
    "outside-program": { semester: 1, status: "planned" },
  });
  assert.equal(result.percent, 33);
  assert.equal(result.completedUnits, 4);
  assert.equal(result.activeUnits, 3);
  assert.deepEqual(result.upcoming.map(course => course.id), ["C"]);
});

test("empty program has finite zero progress", () => {
  assert.equal(overviewData({ courses: [], requirementGroups: [] }, new Set(), {}).percent, 0);
});

test("progress reaches 100 percent only when all listed core courses are completed", () => {
  const result = overviewData(catalog, new Set(["A", "B", "C"]), {});
  assert.equal(result.completed.length, 3);
  assert.equal(result.required.length, 3);
  assert.equal(result.percent, 100);
});
