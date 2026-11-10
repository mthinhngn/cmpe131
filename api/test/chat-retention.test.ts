import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaService } from "../src/prisma/prisma.service";
import { validateCommand } from "../src/workspace.service";

const guestMigration = readFileSync(new URL("../prisma/migrations/20261104020000_session_only_chat/migration.sql", import.meta.url), "utf8");
const accountMigration = readFileSync(new URL("../users/migrations/20261104020000_session_only_chat/migration.sql", import.meta.url), "utf8");

test("guest and account migrations match; chat writes are rejected before storage", () => {
  assert.equal(guestMigration, accountMigration);
  assert.throws(() => validateCommand({ requestId: "chat", version: 0, kind: "message", args: { message: { text: "private chat" } } }), /database chat storage is disabled/);
});

test("chat removal preserves plans, schedules, profile context and replay receipts", { skip: process.env.WORKSPACE_DB_TEST !== "1" }, async () => {
  const db = new PrismaService();
  try {
    await db.$transaction(async tx => {
      // Temporary tables shadow live tables, so this test cannot purge real history.
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "PersonalWorkspace" (id text, state jsonb, version int, "updatedAt" timestamp DEFAULT now()) ON COMMIT DROP');
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "PersonalOperation" ("workspaceId" text, kind text, "before" jsonb, result jsonb) ON COMMIT DROP');
      const result = { status: "success", revision: 2, edits: [{ courseId: "c1", after: { semester: 2, status: "planned" } }] };
      const state = { plans: { ce: { c1: { semester: 2 } } }, completed: ["c2"], schedules: { ce: ["10000"] }, startingTerms: { ce: "fall-2025" }, revision: 2,
        messages: { ce: [{ id: "legacy-proposal", role: "assistant", text: "private assistant reply", ...result }, { id: "user", role: "user", text: "private user message" }] } };
      await tx.$executeRawUnsafe('INSERT INTO "PersonalWorkspace" VALUES ($1,$2::jsonb,7,now())', "test", JSON.stringify(state));
      await tx.$executeRawUnsafe('INSERT INTO "PersonalOperation" VALUES ($1,$2,$3::jsonb,$4::jsonb)', "test", "apply", JSON.stringify(state), JSON.stringify(result));
      for (const statement of guestMigration.split(";").filter(s => s.trim())) await tx.$executeRawUnsafe(statement);
      const [workspace] = await tx.$queryRawUnsafe<any[]>('SELECT state,version FROM "PersonalWorkspace"');
      assert.deepEqual(workspace.state, { ...state, messages: {} });
      assert.equal(workspace.version, 8);
      const [operation] = await tx.$queryRawUnsafe<any[]>('SELECT "before",result FROM "PersonalOperation"');
      assert.deepEqual(operation.before, { ...state, messages: {} });
      assert.deepEqual(operation.result, { ...result, proposalRequestId: "legacy-proposal" });
      for (const statement of guestMigration.split(";").filter(s => s.trim())) await tx.$executeRawUnsafe(statement);
      const [again] = await tx.$queryRawUnsafe<any[]>('SELECT version FROM "PersonalWorkspace"');
      assert.equal(again.version, 8);
    });
  } finally { await db.$disconnect(); }
});
