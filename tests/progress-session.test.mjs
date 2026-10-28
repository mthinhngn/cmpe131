import test from "node:test";
import assert from "node:assert/strict";
import { readProgressSession, writeProgressSession } from "../src/progressSession.ts";
import { overviewData } from "../src/overviewData.ts";

test("completed courses and program survive a fresh page session read", () => {
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  writeProgressSession({ program: "software-engineering", completedCourseIds: ["A", "B", "outside-program"] }, storage);
  const restored = readProgressSession(storage);
  assert.equal(restored.program, "software-engineering");
  const catalog = { courses: [{ id: "A", units: 4 }, { id: "B", units: 3 }, { id: "C", units: 3 }], requirementGroups: [{ items: [{ courseId: "A" }, { courseId: "B" }, { courseId: "C" }] }] };
  const progress = overviewData(catalog, new Set(restored.completedCourseIds), {});
  assert.equal(progress.completed.length, 2);
  assert.equal(progress.required.length, 3);
  assert.equal(progress.percent, 67);
});

test("invalid saved data cannot invent completion or a program", () => {
  assert.deepEqual(readProgressSession({ getItem: () => "broken JSON" }), { program: "computer-engineering", completedCourseIds: [] });
  assert.deepEqual(readProgressSession({ getItem: () => JSON.stringify({ program: "unknown", completedCourseIds: ["A", "A", null, 42, ""] }) }), { program: "computer-engineering", completedCourseIds: ["A"] });
});

test("blocked storage does not break the draft", () => {
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readProgressSession(blocked).completedCourseIds.length, 0);
  assert.doesNotThrow(() => writeProgressSession({ program: "computer-engineering", completedCourseIds: [] }, blocked));
});
