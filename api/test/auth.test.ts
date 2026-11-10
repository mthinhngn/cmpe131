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
  const service: any = { create: async () => ++calls, read: async () => ++calls, execute: async () => ++calls };
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

test("real PostgreSQL account lifecycle, isolation, sessions and workspace sync", { skip: process.env.AUTH_DB_TEST !== "1" }, async () => {
  const { AppModule } = require("../dist/app.module");
  const app = await NestFactory.create(AppModule, { logger: ["error"] });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const auth = app.get<AuthService>(require("../dist/auth/auth.service").AuthService), users = app.get<UsersService>(require("../dist/auth/users.service").UsersService);
  const suffix = newToken().slice(0, 16), email = `auth-test-${suffix}@example.com`;
  let link = "";
  (auth as any).logger.log = (message: string) => { link = message; };
  const call = async (path: string, body?: unknown, cookie = "", expected = "guest", origin = "http://localhost:5175") => {
    const res = await fetch(`${base}/api/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie, "X-Workspace-User": expected, Authorization: `Bearer ${guest}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json() as any, cookie: res.headers.get("set-cookie") || "" };
  };
  const guest = newToken();
  const oldDelivery = process.env.AUTH_DELIVERY;
  process.env.AUTH_DELIVERY = "log";
  try {
    assert.equal((await call("auth/me")).body.user, null);
    assert.equal((await call("auth/link", { email }, "", "guest", "https://untrusted.example")).status, 403);
    assert.equal((await call("auth/link", { email })).status, 201);
    const token = /token=([a-f0-9]{64})/.exec(link)![1];
    link = "";
    await call("auth/link", { email });
    assert.equal(link, "", "email cooldown prevents repeated links");
    const guestWorkspace = await call("workspace", {});
    assert.equal(guestWorkspace.status, 201);
    const guestCourse = guestWorkspace.body.state.catalog.courses[0];
    await call("workspace/operations", { requestId: newToken(), version: guestWorkspace.body.version, kind: "setPlan", args: { id: guestCourse.id, semester: 2 } });
    const attempts = await Promise.all([call("auth/verify", { token }), call("auth/verify", { token })]);
    assert.deepEqual(attempts.map(a => a.status).sort(), [201, 401]);
    const login = attempts.find(a => a.status === 201)!;
    assert.match(login.cookie, /HttpOnly/i); assert.match(login.cookie, /SameSite=Lax/i);
    const cookie = login.cookie.split(";")[0], id = login.body.user.id;
    assert.equal(login.body.user.workspaceKey, undefined);
    assert.equal((await call("auth/me", undefined, cookie)).body.user.email, email);
    assert.equal((await call("workspace", {}, cookie, id)).status, 403, "new accounts must save their profile before workspace creation");
    assert.equal((await call("workspace/operations", {}, cookie, id)).status, 403);
    assert.equal((await call("auth/profile", { name: "Account Test", major: "software-engineering", startingSemester: "Fall 2024" }, cookie)).status, 201);
    assert.equal((await call("workspace", {}, cookie, "guest")).status, 401, "stale guest tab cannot modify signed-in account");
    let workspace = (await call("workspace", {}, cookie, id)).body;
    assert.equal(workspace.state.program, "software-engineering");
    assert.deepEqual(workspace.state.plans, {}); assert.deepEqual(workspace.state.completed, []);
    const run = async (kind: string, args: unknown) => {
      const result = await call("workspace/operations", { requestId: newToken(), version: workspace.version, kind, args, catalogVersion: workspace.state.catalog.dataVersion }, cookie, id);
      assert.equal(result.status, 201, JSON.stringify(result.body)); workspace = result.body;
    };
    const course = workspace.state.catalog.courses[0];
    await run("toggleTakenCourse", { id: course.id });
    await run("setPlan", { id: workspace.state.catalog.courses[1].id, semester: 3 });
    const rejectedChat = await call("workspace/operations", { requestId: newToken(), version: workspace.version, kind: "message", args: { program: workspace.state.program, message: { id: newToken(), role: "user", text: "Do not save this conversation" } } }, cookie, id);
    assert.equal(rejectedChat.status, 400);
    assert.deepEqual((await call("workspace", undefined, cookie, id)).body.state.messages, {});
    const offering = workspace.state.catalog.offerings[0];
    assert.ok(offering); await run("schedule", { classNumber: offering.classNumber, selected: true });
    assert.equal((await call("workspace/operations", { requestId: newToken(), version: workspace.version, kind: "importLegacy", args: {} }, cookie, id)).status, 400);
    const secondToken = newToken();
    await users.loginToken.create({ data: { tokenHash: hashToken(secondToken), email, expiresAt: new Date(Date.now() + 60000) } });
    const secondLogin = await call("auth/verify", { token: secondToken });
    const secondCookie = secondLogin.cookie.split(";")[0];
    const restored = (await call("workspace", undefined, secondCookie, id)).body;
    assert.deepEqual(restored.state, workspace.state, "a second browser restores every saved data category");
    const outsiderToken = newToken(), outsiderEmail = `auth-other-${suffix}@example.com`;
    await users.loginToken.create({ data: { tokenHash: hashToken(outsiderToken), email: outsiderEmail, expiresAt: new Date(Date.now() + 60000) } });
    const outsider = await call("auth/verify", { token: outsiderToken });
    assert.equal((await call("workspace", undefined, outsider.cookie.split(";")[0], id)).status, 401);
    await call("auth/profile", { name: "Other Student", major: "computer-engineering", startingSemester: "Fall 2025" }, outsider.cookie.split(";")[0]);
    const outsiderWorkspace = await call("workspace", {}, outsider.cookie.split(";")[0], outsider.body.user.id);
    assert.deepEqual(outsiderWorkspace.body.state.plans, {});
    const oldVersion = workspace.version;
    assert.equal((await call("auth/profile", { name: "Account Test", major: "computer-engineering", startingSemester: "Fall 2024" }, cookie)).status, 201);
    const switched = (await call("workspace", undefined, cookie, id)).body;
    assert.equal(switched.state.program, "computer-engineering");
    assert.ok(switched.version > oldVersion);
    assert.deepEqual(switched.state.plans["software-engineering"], workspace.state.plans["software-engineering"], "settings preserve the other program's saved plan");
    assert.equal((await call("workspace/operations", { requestId: newToken(), version: oldVersion, kind: "addSemester", args: {} }, cookie, id)).status, 409, "stale tabs cannot overwrite the program change");
    await call("auth/profile", { name: "Account Test", major: "software-engineering", startingSemester: "Fall 2024" }, cookie);
    assert.deepEqual((await call("workspace", undefined, cookie, id)).body.state.plans, workspace.state.plans);
    assert.equal((await call("auth/logout", {}, cookie)).status, 201);
    assert.equal((await call("auth/me", undefined, cookie)).status, 401);
    assert.equal((await call("workspace", undefined, "", id)).status, 401, "signed-out tabs must not fall back to guest writes");
    const restoredGuest = await call("workspace");
    assert.equal(restoredGuest.body.state.plans["computer-engineering"][guestCourse.id].semester, 2);
    const expiredToken = newToken();
    await users.loginToken.create({ data: { tokenHash: hashToken(expiredToken), email, expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call("auth/verify", { token: expiredToken })).status, 401);
    const secondSession = sessionToken(secondCookie)!;
    await users.session.update({ where: { tokenHash: hashToken(secondSession) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call("auth/me", undefined, secondCookie)).status, 401);
    // Provider HTTP is intercepted; PostgreSQL and all auth endpoints remain real.
    const savedKey = process.env.RESEND_API_KEY, savedInbox = process.env.AUTH_TEST_EMAIL;
    const originalFetch = globalThis.fetch;
    const deliveryEmail = `mail-test-${suffix}@example.com`;
    let providerCalls = 0, acceptEmail = false, deliveredToken = "";
    process.env.AUTH_DELIVERY = "resend";
    process.env.RESEND_API_KEY = "re_fake_test_key";
    process.env.AUTH_TEST_EMAIL = deliveryEmail;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input) !== "https://api.resend.com/emails") return originalFetch(input, init);
      providerCalls++;
      const sent = JSON.parse(init?.body as string);
      assert.deepEqual(sent.to, [deliveryEmail]);
      deliveredToken = /token=([a-f0-9]{64})/.exec(sent.text)![1];
      return new Response(JSON.stringify(acceptEmail ? { id: "test-email-id" } : { message: "private-provider-detail" }), { status: acceptEmail ? 200 : 403 });
    }) as typeof fetch;
    try {
      assert.equal((await call("auth/me")).body.signInDelivery, "resend");
      assert.equal((await call("auth/link", { email: `not-allowed-${suffix}@example.com` })).status, 400);
      assert.equal(providerCalls, 0);
      const failed = await call("auth/link", { email: deliveryEmail });
      assert.equal(failed.status, 503);
      assert.doesNotMatch(JSON.stringify(failed.body), /private-provider-detail|re_fake_test_key|token=/);
      assert.equal(await users.loginToken.count({ where: { email: deliveryEmail } }), 0, "failed send removes active token and cooldown");
      acceptEmail = true;
      const sent = await call("auth/link", { email: deliveryEmail });
      assert.equal(sent.status, 201, "immediate retry succeeds after delivery failure");
      assert.match(sent.body.message, /Check your inbox/);
      assert.equal(providerCalls, 2);
      await call("auth/link", { email: deliveryEmail });
      assert.equal(providerCalls, 2, "cooldown prevents duplicate provider sends");
      assert.equal(link, "", "email mode never logs bearer links");
      const record = await users.loginToken.findUnique({ where: { tokenHash: hashToken(deliveredToken) } });
      assert.equal(record?.email, deliveryEmail);
      assert.equal((await call("auth/verify", { token: deliveredToken })).status, 201);
      assert.equal((await call("auth/verify", { token: deliveredToken })).status, 401);
    } finally {
      globalThis.fetch = originalFetch;
      if (savedKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedKey;
      if (savedInbox === undefined) delete process.env.AUTH_TEST_EMAIL; else process.env.AUTH_TEST_EMAIL = savedInbox;
    }
    process.env.AUTH_DELIVERY = "disabled";
    assert.equal((await call("auth/link", { email })).status, 503);
  } finally {
    process.env.AUTH_DELIVERY = oldDelivery;
    await app.close();
  }
});
