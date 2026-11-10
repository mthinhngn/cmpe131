import test from "node:test";
import assert from "node:assert/strict";
import { PlanningStore } from "../src/planning-engine";
import { applyAgentAction } from "../src/agent-action";
import type { ProgramCatalog } from "../src/course-types";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../src/prisma/prisma.service";
import { WorkspaceService } from "../src/workspace.service";

const catalog = { courses: [{ id: "course", code: "CMPE 131" }], requirementGroups: Array(8).fill({}) } as ProgramCatalog;
function setup() {
  const store = new PlanningStore("computer-engineering", catalog);
  const action = (kind: string, extra = {}) => ({ kind, action_id: "test-action", tool_call_id: "test-tool", program_id: "computer-engineering", course_id: "course", course_code: "CMPE 131", expected_revision: JSON.stringify({ workspace_revision: store.getState().revision }), ...extra });
  return { store, action };
}
test("agent actions share manual state and preserve move status and named slots", () => {
  const { store, action } = setup();
  applyAgentAction(store, { browserFresh: true, action: action("add_course_to_plan", { semester_slot: 2 }) });
  assert.equal(store.plans.course.semester, 2);
  store.setPlan("course", 2, "in-progress");
  applyAgentAction(store, { browserFresh: true, action: action("move_course_in_plan", { semester_slot: "summer-2027", target_term: { season: "summer", year: 2027 }, previous_semester_slot: 2, previous_status: "in-progress" }) });
  assert.deepEqual(store.plans.course, { semester: "summer-2027", status: "in-progress" });
  assert.equal(store.getState().views["computer-engineering"].semester, "summer-2027");
  applyAgentAction(store, { browserFresh: true, action: action("remove_course_from_plan", { previous_semester_slot: "summer-2027", previous_status: "in-progress" }) });
  assert.deepEqual(store.plans, {});
});
test("stale, duplicate, completed and mismatched source actions never mutate the plan", () => {
  const { store, action } = setup();
  const old = action("add_course_to_plan", { semester_slot: 2 });
  store.setPlan("course", 1);
  for (const attempted of [old, action("add_course_to_plan", { semester_slot: 2 }), action("remove_course_from_plan", { previous_semester_slot: 2, previous_status: "planned" }), action("move_course_in_plan", { semester_slot: "summer-2027", target_term: { season: "summer", year: 2026 }, previous_semester_slot: 1, previous_status: "planned" })]) {
    const before = structuredClone(store.getState());
    assert.throws(() => applyAgentAction(store, { browserFresh: true, action: attempted }));
    assert.deepEqual(store.getState(), before);
  }
  store.toggleTakenCourse("course");
  assert.throws(() => applyAgentAction(store, { browserFresh: true, action: action("add_course_to_plan", { semester_slot: 1 }) }));
  assert.deepEqual(store.getState().completed, ["course"]);
});

test("real PostgreSQL: agent receipt replays after reload and stale context cannot edit", { skip: process.env.WORKSPACE_DB_TEST !== "1" }, async () => {
  const db = new PrismaService(); await db.$connect();
  try {
    const service = new WorkspaceService(db), credential = `Bearer ${randomBytes(32).toString("hex")}`;
    const initial = await service.create(credential), course = initial.state.catalog.courses[0];
    const action = { kind: "add_course_to_plan", action_id: randomBytes(16).toString("hex"), tool_call_id: "test-tool", program_id: initial.state.program, course_id: course.id, course_code: course.code, expected_revision: JSON.stringify({ workspace_revision: initial.state.revision }), semester_slot: 2 };
    const command = { kind: "agentAction", requestId: action.action_id, version: initial.version, args: { action, browserFresh: true } };
    const saved = await service.execute(credential, command);
    const replay = await new WorkspaceService(db).execute(credential, { ...command, version: saved.version });
    assert.equal(replay.replayed, true);
    assert.equal(replay.version, saved.version);
    assert.equal(replay.state.plans[initial.state.program][course.id].semester, 2);
    await assert.rejects(() => service.execute(credential, { ...command, requestId: randomBytes(16).toString("hex"), version: saved.version }), /page or saved plan changed/);
    const after = await service.read(credential);
    assert.equal(after.version, saved.version);
  } finally { await db.$disconnect(); }
});
