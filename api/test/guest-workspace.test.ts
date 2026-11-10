import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceService } from "../src/workspace.service";
import { PlanningStore } from "../src/planning-engine";
import type { ProgramCatalog } from "../src/course-types";
import { WorkspaceController } from "../src/workspace.controller";

test("guest edits, restore and Undo use authoritative catalogs without database writes", async () => {
  const catalog = { courses: [{ id: "course", code: "C 1", recommendedSemester: 1 }], requirementGroups: Array(8).fill({}) } as ProgramCatalog;
  const db = new Proxy({}, { get() { throw Error("Guest operation tried to access persistence"); } });
  const service = new WorkspaceService(db as any);
  (service as any).catalog = async () => catalog;
  const initial = (await service.guest()).state;
  const compact = (state: any) => ({ ...state, catalog: undefined });
  const execute = (state: any, kind: string, args: object, extra = {}) => service.executeGuest({ requestId: "guest-test", version: 0, kind, args, guestState: compact(state), ...extra });
  const edited = await execute(initial, "setPlan", { id: "course", semester: 2 });
  assert.equal(edited.state.plans[initial.program].course.semester, 2);
  assert.deepEqual(initial.plans, {}, "input is not mutated");
  assert.deepEqual((await service.guest(compact(edited.state))).state.plans, edited.state.plans);
  assert.deepEqual((await service.guest()).state.plans, {}, "no server-side guest state survives requests");
  const undone = await execute(edited.state, "undo", { revision: edited.state.revision }, { undoState: compact(initial) });
  assert.deepEqual(undone.state.plans, {});
  await assert.rejects(execute(initial, "setPlan", { id: "forged", semester: 2 }), /Unknown course/);
  await assert.rejects(service.executeGuest({ requestId: "bad", version: 0, kind: "setPlan", args: {} }), /Invalid guest/);
  await assert.rejects(execute(initial, "importLegacy", {}), /Unsupported/);
  assert.equal(new PlanningStore(initial.program, catalog).getState().revision, 0);
});

test("guest routes cannot call account storage; stale account tabs cannot fall back to guests", async () => {
  let calls = 0;
  const service: any = { guest: async () => ++calls, executeGuest: async () => ++calls };
  const auth: any = { current: async () => null };
  const controller = new WorkspaceController(service, auth);
  await controller.create("", "", "guest");
  await controller.execute("", "", "guest", {});
  assert.equal(calls, 2);
  await assert.rejects(controller.execute("", "", "signed-out-account", {}), /Account changed/);
  assert.equal(calls, 2);
});
