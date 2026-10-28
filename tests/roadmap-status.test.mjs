import test from "node:test";
import assert from "node:assert/strict";
import { roadmapStatus } from "../src/roadmapStatus.ts";

const course = { id: "target", prerequisiteCourseIds: ["foundation"], corequisiteCourseIds: [] };

test("explicit completion and in-progress take priority over prerequisites", () => {
  assert.equal(roadmapStatus(course, new Set(["target"]), { target: { status: "in-progress", semester: 2 } }), "complete");
  assert.equal(roadmapStatus(course, new Set(), { target: { status: "in-progress", semester: 2 } }), "current");
});

test("planning a course or its prerequisite does not mean either is completed", () => {
  assert.equal(roadmapStatus(course, new Set(), { target: { status: "planned", semester: 2 }, foundation: { status: "in-progress", semester: 1 } }), "needs-prerequisites");
  assert.equal(roadmapStatus(course, new Set(["foundation"]), {}), "available");
});

test("unmapped prerequisite records remain required", () => {
  assert.equal(roadmapStatus(course, new Set(), {}), "needs-prerequisites");
});

test("placement, grades and consent wording require review", () => {
  assert.equal(roadmapStatus({ ...course, prerequisiteText: "Grade C or better; instructor consent." }, new Set(["foundation"]), {}), "review");
});

test("corequisites need completion or a plan in the same semester", () => {
  const withLab = { ...course, corequisiteCourseIds: ["lab"] };
  const completed = new Set(["foundation"]);
  assert.equal(roadmapStatus(withLab, completed, {}), "review");
  assert.equal(roadmapStatus(withLab, completed, { target: { status: "planned", semester: 2 }, lab: { status: "planned", semester: 1 } }), "review");
  assert.equal(roadmapStatus(withLab, completed, { target: { status: "planned", semester: 2 }, lab: { status: "planned", semester: 2 } }), "available");
});
