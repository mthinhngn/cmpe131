import test from "node:test";
import assert from "node:assert/strict";
import { getHighlightedPath } from "../src/prerequisiteGraph.ts";

const prerequisite = (from, to) => ({ from, to, kind: "prerequisite" });

test("traces every upstream and downstream branch without unrelated siblings", () => {
  const path = getHighlightedPath("B", [prerequisite("A", "B"), prerequisite("B", "C"), prerequisite("B", "D"), prerequisite("D", "E"), prerequisite("A", "X")]);
  assert.deepEqual([...path.upstreamIds].sort(), ["A"]);
  assert.deepEqual([...path.downstreamIds].sort(), ["C", "D", "E"]);
  assert.equal(path.courseIds.has("X"), false);
  assert.equal(path.connectionIds.size, 4);
});

test("a corequisite does not block traversal when it is also on a prerequisite path", () => {
  const path = getHighlightedPath("B", [{ from: "B", to: "C", kind: "corequisite" }, prerequisite("B", "C"), prerequisite("C", "D")]);
  assert.equal(path.corequisiteIds.has("C"), true);
  assert.deepEqual([...path.downstreamIds].sort(), ["C", "D"]);
  assert.equal(path.upstreamIds.size, 0);
});

test("cycles terminate and clearing focus removes all emphasis", () => {
  const edges = [prerequisite("A", "B"), prerequisite("B", "A"), prerequisite("B", "C")];
  const path = getHighlightedPath("A", edges);
  assert.deepEqual([...path.downstreamIds].sort(), ["B", "C"]);
  assert.equal(path.upstreamIds.has("A"), false);
  assert.equal(getHighlightedPath(null, edges).connectionIds.size, 0);
});

test("corequisite focus stays symmetric without traversing a corequisite's prerequisites", () => {
  const edges = [prerequisite("parent", "lab"), { from: "lecture", to: "lab", kind: "corequisite" }];
  const lecture = getHighlightedPath("lecture", edges);
  assert.equal(lecture.courseIds.has("lab"), true);
  assert.equal(lecture.courseIds.has("parent"), false);
  assert.equal(getHighlightedPath("lab", edges).corequisiteIds.has("lecture"), true);
  edges.push(prerequisite("lecture", "next"));
  assert.equal(getHighlightedPath("lecture", edges).downstreamIds.has("next"), true);
});
