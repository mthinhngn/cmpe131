import test from "node:test";
import assert from "node:assert/strict";
import { courseDependencies } from "../src/course-dependencies";

const ids = new Map([["EE 97", "ee97"], ["EE 98", "ee98"], ["MATH 33LA", "math33la"], ["MATH 33A", "math33a"]]);
test("grade wording and major restrictions retain explicit mandatory course connections", () => {
  assert.deepEqual(courseDependencies('EE 97 and EE 98 both with grades of C- or better. Allowed Declared Major: Electrical Engineering.', ["EE 97", "EE 98"], ids), { required: ["ee97", "ee98"], conditional: [] });
});
test("EE 112 alternatives remain visible without becoming three mandatory prerequisites", () => {
  assert.deepEqual(courseDependencies('EE 98 and MATH 33LA or MATH 33A (each with grade of C- or better).', ["EE 98", "MATH 33LA", "MATH 33A"], ids), { required: [], conditional: ["ee98", "math33la", "math33a"] });
  assert.deepEqual(courseDependencies('EE 98 or instructor consent.', ["EE 98", "unknown"], ids), { required: [], conditional: ["ee98"] });
});
