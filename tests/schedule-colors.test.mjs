import test from "node:test";
import assert from "node:assert/strict";
import { scheduleCourseColors } from "../src/scheduleColors.ts";

test("calendar colors distinguish courses, share components and survive reordered reloads", () => {
  const codes = ["CMPE 30", "CMPE 50", "CMPE 131", "MATH 31", "PHYS 50", "CS 46A", "ENGL 1A", "ENGR 10", "EE 98"];
  const colors = scheduleCourseColors([...codes, "CMPE 131"]);
  assert.equal(colors.size, codes.length);
  assert.equal(new Set([...colors.values()].map(style => style["--course-fill"])).size, codes.length);
  assert.deepEqual(colors, scheduleCourseColors([...codes].reverse()));
  for (const preview of ["CMPE 131", "BIOL 10"]) {
    const previewColors = scheduleCourseColors(codes, preview);
    for (const code of codes) assert.deepEqual(previewColors.get(code), colors.get(code));
    assert.ok(previewColors.has(preview));
  }
  assert.equal(scheduleCourseColors([]).size, 0);
});
