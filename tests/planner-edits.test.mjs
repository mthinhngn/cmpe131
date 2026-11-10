import test from "node:test";
import assert from "node:assert/strict";
import { PlannerEdits } from "../src/PlannerEdits.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("course previews appear before save, block duplicates, and survive another course's response", async () => {
  const edits = new PlannerEdits(), a = deferred(), b = deferred();
  const errors = [];
  const onError = error => errors.push(error);
  let notifications = 0;
  const unsubscribe = edits.subscribe(() => notifications++);
  const first = edits.run("a", { plan: { semester: 2, status: "planned" } }, () => a.promise, onError);
  const second = edits.run("b", { completed: true }, () => b.promise, onError);
  assert.equal(edits.getState().a.plan.semester, 2);
  assert.equal(edits.getState().b.completed, true);
  assert.equal(await edits.run("a", { plan: null }, () => { throw Error("duplicate reached save"); }, onError), false);
  a.resolve();
  assert.equal(await first, true);
  assert.deepEqual(edits.getState(), { b: { completed: true } });
  b.resolve();
  assert.equal(await second, true);
  assert.deepEqual(edits.getState(), {});
  assert.equal(notifications, 4);
  assert.deepEqual(errors, []);
  unsubscribe();
});

test("failed completion rolls back only its preview and can be attempted again", async () => {
  const edits = new PlannerEdits(), a = deferred(), b = deferred(), errors = [];
  const first = edits.run("a", { completed: false }, () => a.promise, error => errors.push(error.message));
  const second = edits.run("b", { plan: null }, () => b.promise, error => errors.push(error.message));
  a.reject(Error("save failed"));
  assert.equal(await first, false);
  assert.deepEqual(errors, ["save failed"]);
  assert.deepEqual(edits.getState(), { b: { plan: null } });
  b.resolve();
  await second;
  assert.equal(await edits.run("a", { completed: false }, async () => {}, assert.fail), true);
});
