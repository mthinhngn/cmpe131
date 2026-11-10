import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { workspaceHash, validateCommand, applyManual, WorkspaceService } from "../src/workspace.service";
import { PlanningStore } from "../src/planning-engine";
import type { ProgramCatalog } from "../src/course-types";
import { PrismaService } from "../src/prisma/prisma.service";

test("private workspace credential and operation trust boundaries", () => {
  for (const input of [undefined, "", "Bearer predictable", "Basic abc"]) assert.throws(() => workspaceHash(input));
  const token = `Bearer ${randomBytes(32).toString("hex")}`;
  assert.equal(workspaceHash(token), workspaceHash(token)); assert.notEqual(workspaceHash(token), token.slice(7));
  for (const input of [null, {}, { requestId: "x", version: -1, args: {}, kind: "setPlan" }, { requestId: "x", version: 0, args: null, kind: "setPlan" }]) assert.throws(() => validateCommand(input));
});
test("manual operations validate current catalog and preserve completion rules", () => {
  const catalog = { courses: [{ id: "course", code: "C 1", recommendedSemester: 1 }], requirementGroups: Array(8).fill({}) } as ProgramCatalog;
  const store = new PlanningStore("computer-engineering", catalog);
  const beforeRoadmap = structuredClone(store.getState());
  assert.throws(() => applyManual(store, "roadmap", {}, {}), /Unsupported workspace operation/);
  assert.deepEqual(store.getState(), beforeRoadmap, "removed roadmap operation cannot change the saved plan");
  assert.throws(() => applyManual(store, "setPlan", { id: "unknown", semester: 1 }, {}));
  applyManual(store, "setPlan", { id: "course", semester: 2 }, {});
  applyManual(store, "toggleTakenCourse", { id: "course" }, {});
  assert.equal(store.plans.course.semester, 2); assert.deepEqual(store.getState().completed, ["course"]);
  assert.throws(() => applyManual(store, "setTerm", { semester: 1, term: {} }, {}));
});
test("database failures never create temporary workspace success", async () => {
  const db = { personalWorkspace: { findUnique: async () => { throw new Error("connection refused"); } } } as unknown as PrismaService;
  await assert.rejects(() => new WorkspaceService(db).read(`Bearer ${randomBytes(32).toString("hex")}`), /PostgreSQL could not confirm/);
});

test("schedule writes verify the calendar and load the imported section snapshot", async t => {
  const requests: string[] = [];
  const sectionTerms: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url.pathname + url.search);
    return Response.json(url.pathname.endsWith("/schedule/terms")
      ? { status: "verified", current_term: { season: "fall", year: 2026 }, next_term: { season: "spring", year: 2027 }, as_of: "2026-01-01", valid_until: "2026-12-31" }
      : { term: "fall-2026", status: "available", offerings: [] });
  });
  const db = {
    sharedAcademicCalendar: { findUnique: async () => ({ evidence: { status: "verified", current_term: { season: "fall", year: 2026 }, next_term: { season: "spring", year: 2027 }, as_of: "2026-01-01", valid_until: "2026-12-31" } }) },
    $queryRaw: async (_query: TemplateStringsArray, term: string) => { sectionTerms.push(term); return []; },
    personalWorkspace: { findUnique: async () => ({ id: "calendar-contract", state: { program: "computer-engineering" } }) },
    $transaction: async () => { throw new Error("Stop before database writes."); },
  } as unknown as PrismaService;
  const service = new WorkspaceService(db);
  t.mock.method(service as any, "catalog", async () => ({}));
  await assert.rejects(() => service.execute(`Bearer ${randomBytes(32).toString("hex")}`, {
    requestId: "calendar-contract", version: 0, kind: "syncPlan",
    args: { baseKind: "setPlan", baseArgs: { id: "course", semester: 1 }, term: "fall-2026", selected: [] },
  }), /PostgreSQL could not confirm/);
  assert.deepEqual(requests, [], "manual scheduling does not depend on the AI service");
  assert.deepEqual(sectionTerms, ["fall-2026"]);
});

test("planner-only saves do not wait for calendar or section services", async t => {
  t.mock.method(globalThis, "fetch", async () => assert.fail("Planning must not fetch calendar or sections"));
  const db = {
    personalWorkspace: { findUnique: async () => ({ id: "planner-only", state: { program: "computer-engineering" } }) },
    $transaction: async () => { throw new Error("Stop before database writes."); },
  } as unknown as PrismaService;
  const service = new WorkspaceService(db);
  t.mock.method(service as any, "catalog", async () => ({}));
  await assert.rejects(() => service.execute(`Bearer ${randomBytes(32).toString("hex")}`, {
    requestId: "planner-only", version: 0, kind: "syncPlan",
    args: { baseKind: "setPlan", baseArgs: { id: "course", semester: 1 }, selected: [] },
  }), /PostgreSQL could not confirm/);
});

test("real PostgreSQL: durable state, tab-only chat, Undo, isolation, duplicate delivery, conflicts and restart", { skip: process.env.WORKSPACE_DB_TEST !== "1" }, async () => {
  // Only creates uniquely keyed test workspaces. Never resets or deletes existing data.
  const db = new PrismaService(); await db.$connect();
  const auth = `Bearer ${randomBytes(32).toString("hex")}`, other = `Bearer ${randomBytes(32).toString("hex")}`;
  let service = new WorkspaceService(db), saved = await service.create(auth);
  const run = async (kind: string, args = {}) => {
    const response = await service.execute(auth, { requestId: randomBytes(16).toString("hex"), version: saved.version, kind, args, catalogVersion: saved.state.catalog.dataVersion });
    saved = response; return response;
  };
  try {
    await run("selectProgram", { program: "software-engineering" });
    await run("setTerm", { semester: 2, term: "Fall 2026" });
    await run("addSemester");
    const course = saved.state.catalog.courses.find(c => c.code === "CMPE 120")!;
    assert.ok(course);
    await run("setPlan", { id: course.id, semester: 2, status: "in-progress" });
    const beforeMessage = saved.version;
    await assert.rejects(() => run("message", { program: saved.state.program, message: { id: "resume-message", role: "user", text: "Move CMPE 120 to Semester 3" } }), /database chat storage is disabled/);
    assert.equal((await service.read(auth)).version, beforeMessage);
    const action = { requestId: "ai-action", revision: saved.state.revision, program: saved.state.program, selectedCourseId: null, actions: [{ operation: "move", course: "CMPE 120", target: "Semester 3" }] };
    const command = { requestId: "durable-operation", version: saved.version, kind: "apply", catalogVersion: saved.state.catalog.dataVersion, args: { proposal: action, reviewed: false } };
    const first = await service.execute(auth, command); saved = first;
    assert.equal(first.state.plans["software-engineering"][course.id].semester, 3);
    const duplicate = await service.execute(auth, command);
    assert.equal(duplicate.replayed, true); assert.equal(duplicate.version, first.version);
    assert.deepEqual(duplicate.state.messages, {});
    await assert.rejects(() => service.execute(auth, { ...command, args: { proposal: action, reviewed: true } }), /reused/);
    // New Prisma connection and service simulate the backend being restarted.
    await db.$disconnect(); await db.$connect(); service = new WorkspaceService(db);
    saved = await service.read(auth);
    assert.equal(saved.state.terms["software-engineering"][2], "Fall 2026");
    const repeatedAction = await service.execute(auth, { ...command, requestId: "same-tool-new-delivery", version: saved.version });
    assert.equal(repeatedAction.replayed, true);
    assert.equal(repeatedAction.version, saved.version);
    assert.equal(repeatedAction.result.status, "unchanged");
    assert.equal(saved.state.counts["software-engineering"], 9);
    assert.deepEqual(saved.state.messages, {});
    assert.ok((await db.personalOperation.findMany({ where: { workspaceId: (await db.personalWorkspace.findUniqueOrThrow({ where: { tokenHash: workspaceHash(auth) } })).id } })).every(op => Object.keys((op.before as any).messages ?? {}).length === 0));
    await run("undo", { revision: saved.state.revision });
    assert.deepEqual(saved.state.plans["software-engineering"][course.id], { semester: 2, status: "in-progress" });
    const isolated = await service.create(other); assert.deepEqual(isolated.state.plans, {});
    const imported = await service.execute(other, { requestId: "legacy-import", version: 0, kind: "importLegacy", args: { program: "software-engineering", completed: [course.id], schedules: {} } });
    assert.equal(imported.state.program, "software-engineering"); assert.ok(imported.state.completed.includes(course.id));
    await assert.rejects(() => service.execute(other, { requestId: "legacy-again", version: imported.version, kind: "importLegacy", args: { program: "software-engineering", completed: [], schedules: {} } }), /empty workspace/);
    await assert.rejects(() => service.read(undefined), /credential/);
    const version = saved.version;
    const commands = ["a", "b"].map(requestId => ({ requestId: `${requestId}-${randomBytes(6).toString("hex")}`, version, kind: "setPlan", args: { id: course.id, semester: 4 }, catalogVersion: saved.state.catalog.dataVersion }));
    const concurrent = await Promise.allSettled(commands.map(c => service.execute(auth, c)));
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter(r => r.status === "rejected").length, 1);
    saved = await service.read(auth);
    const prior = saved.version;
    await assert.rejects(() => run("setPlan", { id: "invented", semester: 1 }), /Unknown/);
    assert.equal((await service.read(auth)).version, prior);
    await run("toggleTakenCourse", { id: course.id });
    assert.ok(saved.state.plans["software-engineering"][course.id]);
    assert.ok(saved.state.completed.includes(course.id));
    await assert.rejects(() => run("apply", { proposal: { ...action, requestId: "complete-block", revision: saved.state.revision }, reviewed: false }), /completed/);
    await run("view", { semester: 9, selectedCourseId: course.id });
    assert.equal((await service.read(auth)).state.views["software-engineering"].semester, 9);
    const offering = saved.state.catalog.offerings[0];
    assert.ok(offering);
    await run("schedule", { classNumber: offering.classNumber, selected: true });
    const scope = `software-engineering:${saved.state.catalog.catalogYear}:${saved.state.catalog.currentTerm.id}`;
    assert.ok((await service.read(auth)).state.schedules[scope].includes(offering.classNumber));
    await run("undo", { revision: saved.state.revision });
    assert.equal(saved.state.schedules[scope]?.includes(offering.classNumber) ?? false, false);
    // A receipt insert failure must roll back the preceding workspace update in the same transaction.
    const initialVersion = saved.version;
    const brokenDb = new Proxy(db, { get(target, key) {
      if (key !== "$transaction") return Reflect.get(target, key);
      return (fn: any, options: any) => db.$transaction(tx => fn(new Proxy(tx, { get(t, k) { return k === "personalOperation" ? { ...t.personalOperation, create: async () => { throw new Error("injected receipt failure"); } } : Reflect.get(t, k); } })), options);
    } });
    await assert.rejects(() => new WorkspaceService(brokenDb).execute(auth, { requestId: "rollback-check", version: saved.version, kind: "addSemester", args: {}, catalogVersion: saved.state.catalog.dataVersion }), /could not confirm/);
    assert.equal((await service.read(auth)).version, initialVersion);
    const beforeRefresh = await service.read(auth);
    const refreshing = new WorkspaceService(db);
    (refreshing as any).catalog = async () => ({ ...beforeRefresh.state.catalog, dataVersion: `${beforeRefresh.state.catalog.dataVersion}-test-refresh` });
    const refreshed = await refreshing.read(auth);
    assert.equal(refreshed.state.revision, beforeRefresh.state.revision + 1);
    assert.deepEqual(refreshed.state.plans, beforeRefresh.state.plans);
    assert.equal(refreshed.state.undoRevision, undefined);
    saved = await service.read(auth); // Restore the serving catalog through the same normal refresh path.
  } finally { await db.$disconnect(); }
});
