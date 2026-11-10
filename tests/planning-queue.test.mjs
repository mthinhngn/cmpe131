import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// Bundle the browser store with Vite's env shape so it runs under Node.
const dir = mkdtempSync(join(tmpdir(), "planning-queue-"));
const file = join(dir, "store.mjs");
await build({ stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
  export { PersistentPlanningStore } from "./src/PersistentPlanningStore.ts";
  export { PlanningStore } from "./src/planning.ts";
  export { computerEngineeringCatalog } from "./src/data.ts";` },
  bundle: true, format: "esm", platform: "neutral", outfile: file, logLevel: "error",
  define: { "import.meta.env": JSON.stringify({ VITE_API_URL: "/api/v1", VITE_STATIC_PREVIEW: "0" }) } });
const { PersistentPlanningStore, PlanningStore, computerEngineeringCatalog } = await import(pathToFileURL(file).href);
test.after(() => rmSync(dir, { recursive: true, force: true }));

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

/** Fake account API: applies each operation with the real engine, but only when the test releases it. */
function fakeServer() {
  const server = new PlanningStore("computer-engineering", computerEngineeringCatalog);
  let version = 0;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    if (!String(url).endsWith("/operations")) return Response.json({ state: server.getState(), version });
    const gate = deferred();
    calls.push({ body, gate });
    const outcome = await gate.promise;
    if (outcome === "fail") return Response.json({ message: "Course is not available in that term." }, { status: 400 });
    const { kind, args } = body;
    if (kind === "setPlan") server.setPlan(args.id, args.semester, args.status ?? "planned");
    if (kind === "removePlan") server.removePlan(args.id);
    if (kind === "toggleTakenCourse") server.toggleTakenCourse(args.id);
    version++;
    return Response.json({ state: server.getState(), version, result: { status: "success", message: "Saved." } });
  };
  return { calls, server };
}
const until = async (check) => { for (let i = 0; i < 200 && !check(); i++) await new Promise(r => setTimeout(r, 5)); assert.ok(check(), "condition not reached"); };
const [a, b] = computerEngineeringCatalog.courses.slice(0, 2).map(c => c.id);

test("queued moves show immediately and save one at a time, in order", async () => {
  const { calls } = fakeServer();
  const store = new PersistentPlanningStore("user-1");
  await store.load();
  const first = store.setPlan(a, 3), second = store.setPlan(b, 3);
  assert.equal(store.getState().plans["computer-engineering"][a].semester, 3, "first move shows before any save");
  assert.equal(store.getState().plans["computer-engineering"][b].semester, 3, "second move shows while the first is saving");
  await until(() => calls.length === 1);
  assert.equal(calls[0].body.args.id, a, "only the first change is sent until it finishes");
  calls[0].gate.resolve("ok");
  assert.equal((await first).status, "success");
  await until(() => calls.length === 2);
  assert.equal(calls[1].body.args.id, b);
  assert.equal(store.getState().plans["computer-engineering"][b].semester, 3, "second move stays visible after the first save lands");
  calls[1].gate.resolve("ok");
  assert.equal((await second).status, "success");
  assert.equal(store.hasQueuedChanges, false);
});

test("the same course can move again while its first move is saving", async () => {
  const { calls } = fakeServer();
  const store = new PersistentPlanningStore("user-1");
  await store.load();
  const first = store.setPlan(a, 2), second = store.setPlan(a, 4);
  assert.equal(store.getState().plans["computer-engineering"][a].semester, 4);
  await until(() => calls.length === 1);
  calls[0].gate.resolve("ok"); await first;
  assert.equal(store.getState().plans["computer-engineering"][a].semester, 4, "latest move still shown after the earlier save");
  await until(() => calls.length === 2);
  calls[1].gate.resolve("ok"); await second;
  assert.equal(store.getState().plans["computer-engineering"][a].semester, 4);
});

test("a rejected change is undone while later changes are kept", async () => {
  const { calls } = fakeServer();
  const store = new PersistentPlanningStore("user-1");
  await store.load();
  const first = store.setPlan(a, 3), second = store.toggleTakenCourse(b);
  assert.ok(store.getState().completed.includes(b));
  await until(() => calls.length === 1);
  calls[0].gate.resolve("fail");
  const result = await first;
  assert.equal(result.status, "error");
  assert.equal(store.getState().plans["computer-engineering"]?.[a], undefined, "failed move is reverted");
  assert.ok(store.getState().completed.includes(b), "the still-queued change stays visible");
  await until(() => calls.length === 2);
  calls[1].gate.resolve("ok"); await second;
  assert.ok(store.getState().completed.includes(b));
});

test("toggling completion twice before saves land shows the final state and saves both", async () => {
  const { calls, server } = fakeServer();
  const store = new PersistentPlanningStore("user-1");
  await store.load();
  const first = store.toggleTakenCourse(a), second = store.toggleTakenCourse(a);
  assert.ok(!store.getState().completed.includes(a));
  await until(() => calls.length === 1);
  calls[0].gate.resolve("ok"); await first;
  assert.ok(!store.getState().completed.includes(a), "saved first toggle plus queued second toggle");
  await until(() => calls.length === 2);
  calls[1].gate.resolve("ok"); await second;
  assert.ok(!server.getState().completed.includes(a));
  assert.ok(!store.getState().completed.includes(a));
});

test("a section preview shows at once and is removed if its save fails", async () => {
  const { calls } = fakeServer();
  const store = new PersistentPlanningStore("user-1");
  await store.load();
  const scope = "computer-engineering:test:fall-2026";
  const preview = s => { const state = s.getState(); s.restore({ ...state, schedules: { ...state.schedules, [scope]: ["12345"] } }); };
  const done = store.command("syncPlan", { baseKind: "removeSection", baseArgs: { id: a, classNumber: "1" }, term: "fall-2026", selected: [] }, preview);
  assert.deepEqual(store.getState().schedules[scope], ["12345"], "section shows before the save");
  await until(() => calls.length === 1);
  calls[0].gate.resolve("fail");
  assert.equal((await done).status, "error");
  assert.equal(store.getState().schedules[scope], undefined, "preview removed after the failed save");
  assert.equal(store.hasQueuedChanges, false);
});
