import test from "node:test";
import assert from "node:assert/strict";
import { accountResponse } from "../src/api.ts";

test("account bootstrap preserves JSON responses and API errors", async () => {
  assert.deepEqual(await accountResponse(Response.json({ user: null })), { user: null });
  await assert.rejects(accountResponse(Response.json({ message: "Session expired" }, { status: 401 })), /Session expired/);
});

test("HTML fallback and empty proxy errors explain the connection failure", async () => {
  for (const response of [new Response("<!doctype html><html></html>"), new Response("", { status: 500 })]) {
    await assert.rejects(accountResponse(response), /Check that the API is running.*API proxy/);
  }
});
