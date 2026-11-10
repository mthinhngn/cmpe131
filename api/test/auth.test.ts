import "dotenv/config";
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import { AuthService, emailAddress, profileFields, sessionToken, hashToken, newToken } from "../src/auth/auth.service";
import { UsersService } from "../src/auth/users.service";
import { WorkspaceController } from "../src/workspace.controller";

test("incomplete signed-in profiles cannot initialize, read, or edit a workspace", async () => {
  let calls = 0;
  let user: any = { id: "student", name: "", major: "", startingSemester: "", workspaceKey: newToken() };
  const auth: any = { current: async () => user, users: {} };
  const service: any = { create: async () => ++calls, read: async () => ++calls, execute: async () => ++calls, guest: async () => ++calls };
  const controller = new WorkspaceController(service, auth);
  for (const request of [() => controller.create("", "", "student"), () => controller.read("", "", "student"), () => controller.execute("", "", "student", {})]) {
    await assert.rejects(request, /Complete your profile/);
  }
  assert.equal(calls, 0);
  user = { ...user, name: "Student", major: "software-engineering", startingSemester: "Fall 2024" };
  await controller.create("", "", "student");
  assert.equal(calls, 1);
  user = null;
  await controller.create("", "guest-credential", "guest");
  assert.equal(calls, 2, "guest access remains available");
});

test("account trust boundaries reject invalid emails, profiles and cookies", () => {
  assert.equal(emailAddress(" Student@SJSU.edu "), "student@sjsu.edu");
  for (const value of [null, {}, "bad", "a@b", "a b@c.edu", "a@b.edu\nforged"]) assert.throws(() => emailAddress(value));
  const profile = { name: " Student ", major: "software-engineering", startingSemester: "Fall 2024" };
  assert.equal(profileFields(profile).name, "Student");
  for (const value of [null, {}, { ...profile, name: " " }, { ...profile, major: "forged/major" }, { ...profile, startingSemester: "Fall 24" }]) assert.throws(() => profileFields(value));
  const token = newToken();
  assert.equal(sessionToken(`other=a; cr_session=${token}; another=b`), token);
  assert.equal(sessionToken("cr_session=invalid"), undefined);
  assert.notEqual(hashToken(token), token);
});

test("real PostgreSQL Google sign-in, saved workspace, isolation and retired email routes", { skip: process.env.AUTH_DB_TEST !== "1" }, async t => {
  const { AppModule } = require("../dist/app.module");
  const { GoogleAuthService } = require("../dist/auth/google-auth.service");
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const auth = app.get<AuthService>(require("../dist/auth/auth.service").AuthService);
  const users = app.get<UsersService>(require("../dist/auth/users.service").UsersService);
  const google: any = app.get(GoogleAuthService);
  const names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NODE_ENV", "AUTH_WEB_ORIGIN", "WEB_ORIGIN"];
  const previous = Object.fromEntries(names.map(key => [key, process.env[key]]));
  Object.assign(process.env, { GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "private-test-secret", NODE_ENV: "development", AUTH_WEB_ORIGIN: "http://localhost:5175", WEB_ORIGIN: "http://localhost:5175" });
  const suffix = newToken().slice(0, 16), email = `google-test-${suffix}@gmail.com`;
  const outsiderEmail = `google-other-${suffix}@gmail.com`;
  let payload: any;
  t.mock.method(google.verifier, "verifyIdToken", async () => ({ getPayload: () => payload }));
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: any, init?: any) => String(input) === "https://oauth2.googleapis.com/token"
    ? new Response(JSON.stringify({ id_token: "mocked-provider-token" }), { status: 200 }) : originalFetch(input, init));
  const call = async (path: string, body?: unknown, cookie = "", expected = "guest", origin = "http://localhost:5175") => {
    const res = await fetch(`${base}/api/v1/${path}`, { redirect: "manual", method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie, "X-Workspace-User": expected }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: res.status === 303 ? null : await res.json() as any, cookie: res.headers.get("set-cookie") || "", location: res.headers.get("location") || "" };
  };
  const login = async (address: string, subject: string) => {
    const start = await call("auth/google/start", {});
    assert.equal(start.status, 201);
    const url = new URL(start.body.url), state = url.searchParams.get("state")!;
    const cookie = /cr_google_state=([a-f0-9]{64})/.exec(start.cookie)![0];
    payload = { sub: subject, email: address, email_verified: true, nonce: url.searchParams.get("nonce") };
    const callback = `auth/google/callback?state=${state}&code=test-code`;
    const result = await call(callback, undefined, cookie);
    assert.equal(result.status, 303); assert.equal(result.location, "http://localhost:5175/account");
    assert.match(result.cookie, /HttpOnly/); assert.match(result.cookie, /SameSite=Lax/);
    const session = /cr_session=([a-f0-9]{64})/.exec(result.cookie)![0];
    const replay = await call(callback, undefined, cookie);
    assert.match(replay.location, /google_error=failed/);
    return { cookie: session, user: (await call("auth/me", undefined, session)).body.user };
  };
  try {
    assert.equal((await call("auth/link", { email })).status, 404);
    assert.equal((await call("auth/verify", { token: newToken() })).status, 404);
    assert.equal((await call("auth/google/start", {}, "", "guest", "https://untrusted.example")).status, 403);
    const first = await login(email, `subject-${suffix}`), id = first.user.id;
    assert.equal((await call("workspace", {}, first.cookie, id)).status, 403);
    assert.equal((await call("auth/profile", { name: "Google Student", major: "software-engineering", startingSemester: "Fall 2026" }, first.cookie, id)).status, 201);
    const workspace = (await call("workspace", {}, first.cookie, id)).body;
    assert.deepEqual(workspace.state.plans, {});
    const courseId = workspace.state.catalog.courses[0].id;
    const command = { requestId: newToken(), version: workspace.version, kind: "toggleTakenCourse", args: { id: courseId }, catalogVersion: workspace.state.catalog.dataVersion };
    assert.equal((await call("workspace/operations", command, first.cookie, id)).status, 201);
    const second = await login(email, `subject-${suffix}`);
    assert.equal(second.user.id, id);
    assert((await call("workspace", undefined, second.cookie, id)).body.state.completed.includes(courseId));
    const outsider = await login(outsiderEmail, `other-subject-${suffix}`);
    assert.equal((await call("workspace", undefined, outsider.cookie, id)).status, 401);
    assert.equal((await call("workspace", {}, second.cookie, "guest")).status, 401);
    assert.equal((await call("auth/logout", {}, first.cookie)).status, 201);
    assert.equal((await call("auth/me", undefined, first.cookie)).status, 401);
  } finally {
    for (const address of [email, outsiderEmail]) {
      const user = await users.user.findUnique({ where: { email: address } });
      if (!user) continue;
      const workspace = await users.personalWorkspace.findUnique({ where: { tokenHash: hashToken(user.workspaceKey) } });
      if (workspace) { await users.personalOperation.deleteMany({ where: { workspaceId: workspace.id } }); await users.personalWorkspace.delete({ where: { id: workspace.id } }); }
      await users.user.delete({ where: { id: user.id } });
    }
    for (const key of names) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    await app.close();
  }
});
