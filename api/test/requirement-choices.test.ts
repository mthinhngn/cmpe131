import "reflect-metadata";
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PlanningStore } from "../src/planning-engine";
import { applyManual, WorkspaceService, workspaceHash } from "../src/workspace.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { geAreas, requirementMatches } from "../src/requirement-choices";
import type { ProgramCatalog } from "../src/course-types";

const catalog = {
  catalogYear: "2026-2027", currentTerm: { id: "fall-2026" },
  courses: [
    { id: "core", code: "CS 1", units: 3, description: "Satisfies GE Area: 3B.", plannerCategory: "major" },
    { id: "ge", code: "PHIL 1", units: 3, description: "Satisfies GE Area: 3B. Humanities.", plannerCategory: "university" },
    { id: "ge2", code: "PHIL 2", units: 3, description: "Satisfies GE Area: 3B.", plannerCategory: "university" },
    { id: "tech", code: "CMPE 132", units: 3, description: "", plannerCategory: "technical" },
    { id: "other", code: "ART 1", units: 3, description: "Prerequisites: GE Area 3B.", plannerCategory: "university" },
  ],
  requirementGroups: [{ items: [
    { id: "core-item", type: "course", courseId: "core" },
    { id: "ge-item", type: "placeholder", label: "GE Area 3B 3 unit(s)*" },
    { id: "ge-item-2", type: "placeholder", label: "GE Area 3B" },
    { id: "tech-item", type: "placeholder", label: "Technical elective" },
    { id: "uni-item", type: "placeholder", label: "University elective" },
  ] }], offerings: [{ classNumber: "123", courseCode: "PHIL 1" }],
} as unknown as ProgramCatalog;

test("GE filters use satisfaction evidence and keep upper division distinct", () => {
  assert.deepEqual(geAreas("Satisfies GE Area: 5A and 5C. Formerly Area B1 and B3."), ["5A", "5C"]);
  assert.deepEqual(geAreas("Satisfies UD GE Area 4. Satisfies GE Area: 3B."), ["UD 4", "3B"]);
  const item = catalog.requirementGroups[0].items[1];
  assert.equal(requirementMatches(catalog.courses[1], item, catalog), true);
  assert.equal(requirementMatches(catalog.courses[0], item, catalog), false);
  assert.equal(requirementMatches(catalog.courses[4], item, catalog), false);
});

test("requirement choice persists with placement and completion without changing official catalog", () => {
  const store = new PlanningStore("computer-engineering", structuredClone(catalog));
  store.toggleTakenCourse("ge");
  applyManual(store, "chooseRequirement", { requirementId: "ge-item", id: "ge" }, {});
  assert.deepEqual(store.plans.ge, { semester: 1, status: "planned" });
  assert.equal(store.getState().completed.includes("ge"), true);
  assert.equal(store.getState().catalog.requirementGroups[0].items[1].courseId, undefined);
  const restored = new PlanningStore("computer-engineering", catalog);
  restored.restore(JSON.parse(JSON.stringify(store.getState())));
  assert.equal(restored.getState().requirementChoices?.["computer-engineering"]["ge-item"], "ge");
  restored.toggleTakenCourse("ge");
  assert.equal(restored.getState().completed.includes("ge"), false);
  assert.equal(restored.plans.ge.semester, 1);
});

test("invalid and duplicate choices never mutate state", () => {
  const store = new PlanningStore("computer-engineering", catalog);
  store.chooseRequirement("ge-item", "ge");
  for (const [requirementId, id] of [["ge-item", "other"], ["tech-item", "ge2"], ["missing", "ge2"], ["ge-item-2", "ge"], ["core-item", "ge2"]]) {
    const before = structuredClone(store.getState());
    assert.throws(() => applyManual(store, "chooseRequirement", { requirementId, id }, {}));
    assert.deepEqual(store.getState(), before);
  }
});

test("changing a choice clears its prior placement and meetings, preserving completion and other courses", () => {
  const store = new PlanningStore("computer-engineering", catalog);
  store.chooseRequirement("ge-item", "ge");
  store.toggleTakenCourse("ge");
  store.setPlan("core", 1);
  store.restore({ ...store.getState(), schedules: { "computer-engineering:2026-2027:fall-2026": ["123", "456"] } });
  store.chooseRequirement("ge-item", "ge2");
  assert.equal(store.plans.ge, undefined);
  assert.equal(store.plans.ge2.semester, 1);
  assert.equal(store.plans.core.semester, 1);
  assert.equal(store.getState().completed.includes("ge"), true);
  assert.deepEqual(store.getState().schedules["computer-engineering:2026-2027:fall-2026"], ["456"]);
});

test("program choices remain isolated and deleted terms reject new placements", () => {
  const store = new PlanningStore("computer-engineering", catalog);
  store.chooseRequirement("tech-item", "tech");
  store.selectProgram("software-engineering", catalog);
  assert.equal(store.getState().requirementChoices?.["software-engineering"], undefined);
  store.removeSemester(1);
  const before = structuredClone(store.getState());
  assert.throws(() => store.chooseRequirement("uni-item", "other"), /Restore this term/);
  assert.deepEqual(store.getState(), before);
});

test("PostgreSQL saves elective choices, completion, replay receipts and Undo", { skip: process.env.WORKSPACE_DB_TEST !== "1" }, async () => {
  // A unique private test workspace never touches an existing student's data.
  const db = new PrismaService();
  const auth = `Bearer ${randomBytes(32).toString("hex")}`;
  try {
    const service = new WorkspaceService(db);
    let saved = await service.create(auth);
    const program = saved.state.program;
    const item = saved.state.catalog.requirementGroups.flatMap(group => group.items).find(item => item.type === "placeholder" && /technical.*elective/i.test(item.label ?? ""))!;
    const candidates = saved.state.catalog.courses.filter(course => requirementMatches(course, item, saved.state.catalog));
    assert(candidates.length >= 2);
    const run = async (kind: string, args: object) => {
      const command = { requestId: randomBytes(16).toString("hex"), version: saved.version, catalogVersion: saved.state.catalog.dataVersion, kind, args };
      saved = await service.execute(auth, command);
      return command;
    };
    const command = await run("chooseRequirement", { requirementId: item.id, id: candidates[0].id });
    const replay = await service.execute(auth, command);
    assert.equal(replay.version, saved.version);
    await run("toggleTakenCourse", { id: candidates[0].id });
    await run("chooseRequirement", { requirementId: item.id, id: candidates[1].id });
    await run("undo", { revision: saved.state.revision });
    saved = await new WorkspaceService(db).read(auth);
    assert.equal(saved.state.requirementChoices?.[program][item.id], candidates[0].id);
    assert(saved.state.completed.includes(candidates[0].id));
    assert(saved.state.plans[program][candidates[0].id]);
    const row = await db.personalWorkspace.findUniqueOrThrow({ where: { tokenHash: workspaceHash(auth) } });
    assert.deepEqual((row.state as unknown as typeof saved.state).requirementChoices, saved.state.requirementChoices);
  } finally { await db.$disconnect(); }
});
