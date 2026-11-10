import "reflect-metadata";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { GoogleAuthService, googleSettings, googleStateCookie } from "../src/auth/google-auth.service";
import { AuthService } from "../src/auth/auth.service";

const clientId = "123456-test.apps.googleusercontent.com";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
function jwt(payload: object) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const message = `${encode({ alg: "RS256", kid: "test" })}.${encode(payload)}`;
  return `${message}.${sign("RSA-SHA256", Buffer.from(message), keys.privateKey).toString("base64url")}`;
}
function fixture(t: TestContext) {
  const names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NODE_ENV", "AUTH_WEB_ORIGIN", "WEB_ORIGIN"];
  const previous = Object.fromEntries(names.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of names) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  Object.assign(process.env, { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: "private-test-secret", NODE_ENV: "production", AUTH_WEB_ORIGIN: "https://cmpe131.vercel.app", WEB_ORIGIN: "https://cmpe131.vercel.app" });
  const attempts = new Map<string, any>(), identities: any[] = [], requests: URLSearchParams[] = [];
  const db: any = { googleLoginAttempt: {
    create: async ({ data }: any) => { attempts.set(data.stateHash, data); return data; },
    findUnique: async ({ where }: any) => attempts.get(where.stateHash) ?? null,
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (const [key, value] of attempts) {
        if (where.stateHash ? key === where.stateHash && value.expiresAt > where.expiresAt.gt : value.expiresAt <= where.expiresAt.lte) { attempts.delete(key); count++; }
      }
      return { count };
    },
  } };
  db.$transaction = async (run: any) => run(db);
  const service = new GoogleAuthService(db, { googleSignIn: async (identity: any) => { identities.push(identity); return { user: { id: "student" }, session: "session" }; } } as any);
  t.mock.method((service as any).verifier, "getFederatedSignonCertsAsync", async () => ({ certs: { test: keys.publicKey.export({ type: "spki", format: "pem" }) }, format: "PEM" }));
  let token = "";
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.ok(init.signal);
    requests.push(new URLSearchParams(init.body));
    return new Response(JSON.stringify({ id_token: token }), { status: 200 });
  });
  const start = async (overrides = {}) => {
    const attempt = await service.start(), url = new URL(attempt.url);
    const now = Math.floor(Date.now() / 1000);
    token = jwt({ iss: "https://accounts.google.com", aud: clientId, iat: now, exp: now + 3600, sub: "google-student", email: "student@gmail.com", email_verified: true, nonce: url.searchParams.get("nonce"), ...overrides });
    return { ...attempt, cookie: `${googleStateCookie()}=${attempt.state}`, url };
  };
  return { service, attempts, identities, requests, start };
}

test("Google code exchange binds state, PKCE and signed identity to the browser; replay is rejected", async t => {
  const f = fixture(t), attempt = await f.start();
  assert.equal(attempt.url.origin, "https://accounts.google.com");
  assert.equal(attempt.url.searchParams.get("scope"), "openid email profile");
  assert.equal(attempt.url.searchParams.get("redirect_uri"), "https://cmpe131.vercel.app/api/v1/auth/google/callback");
  assert(!attempt.url.searchParams.has("client_secret"));
  await assert.rejects(f.service.finish({ state: "0".repeat(64), code: "code" }, attempt.cookie), /another browser/);
  assert.equal(f.requests.length, 0);
  const result = await f.service.finish({ state: attempt.state, code: "code" }, attempt.cookie);
  assert.equal(result.session, "session");
  assert.equal(f.identities[0].subject, "google-student");
  assert.equal(f.identities[0].authoritativeEmail, true);
  assert.equal(f.requests[0].get("client_secret"), "private-test-secret");
  const challenge = createHash("sha256").update(f.requests[0].get("code_verifier")!).digest("base64url");
  assert.equal(challenge, attempt.url.searchParams.get("code_challenge"));
  await assert.rejects(f.service.finish({ state: attempt.state, code: "code" }, attempt.cookie), /expired/);
  assert.equal(f.requests.length, 1);
});

test("invalid audience, issuer, expiry, nonce and unverified email never create sessions", async t => {
  const f = fixture(t);
  for (const overrides of [{ aud: "wrong-client" }, { iss: "https://attacker.example" }, { iat: 1, exp: 2 }, { nonce: "wrong-nonce" }, { email_verified: false }]) {
    const attempt = await f.start(overrides);
    await assert.rejects(f.service.finish({ state: attempt.state, code: "code" }, attempt.cookie), /verif/);
  }
  assert.equal(f.identities.length, 0);
});

test("SJSU Workspace identities are accepted; denied and expired attempts cannot authenticate", async t => {
  const f = fixture(t), school = await f.start({ email: "student@sjsu.edu", hd: "sjsu.edu" });
  await f.service.finish({ state: school.state, code: "school-code" }, school.cookie);
  assert.equal(f.identities[0].authoritativeEmail, true);
  const denied = await f.start();
  await assert.rejects(f.service.finish({ state: denied.state, error: "access_denied" }, denied.cookie), /canceled/);
  assert.equal(f.requests.length, 1);
  const expired = await f.start();
  for (const value of f.attempts.values()) value.expiresAt = new Date(0);
  await assert.rejects(f.service.finish({ state: expired.state, code: "code" }, expired.cookie), /expired/);
  assert.equal(f.identities.length, 1);
});

test("Google setup requires server credentials and approved callbacks, with localhost supported in development", t => {
  fixture(t);
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.throws(googleSettings, /not configured/);
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  for (const origin of ["http://cmpe131.vercel.app", "https://attacker.example", "https://cmpe131.vercel.app/other", "http://localhost:5175"]) {
    process.env.AUTH_WEB_ORIGIN = origin;
    assert.throws(googleSettings, /not approved/);
  }
  process.env.NODE_ENV = "development";
  assert.equal(googleSettings().redirectUri, "http://localhost:5175/api/v1/auth/google/callback");
});

test("Google login reuses account identity and workspace; conflicting email links fail closed", async () => {
  const users: any[] = [], sessions: any[] = [];
  const tx: any = { $queryRaw: async () => [], user: {
    findUnique: async ({ where }: any) => users.find(user => Object.entries(where).every(([key, value]) => user[key] === value)) ?? null,
    create: async ({ data }: any) => { const user = { id: `user-${users.length}`, name: "", major: "", startingSemester: "", ...data }; users.push(user); return user; },
    update: async ({ where, data }: any) => Object.assign(users.find(user => user.id === where.id), data),
  }, session: { create: async ({ data }: any) => { sessions.push(data); return data; } } };
  const service = new AuthService({ $transaction: async (run: any) => run(tx) } as any, {} as any);
  const identity = { subject: "google-one", email: "student@gmail.com", name: "Student", authoritativeEmail: true };
  const first = await service.googleSignIn(identity), workspaceKey = users[0].workspaceKey;
  const again = await service.googleSignIn(identity);
  assert.equal(first.user.id, again.user.id); assert.equal(users.length, 1);
  assert.equal(users[0].workspaceKey, workspaceKey); assert.notEqual(first.session, again.session);
  assert.notEqual(sessions[0].tokenHash, first.session);
  const changed = await service.googleSignIn({ ...identity, email: "changed@gmail.com" });
  assert.equal(changed.user.id, first.user.id); assert.equal(changed.user.email, "changed@gmail.com");
  users.push({ id: "legacy", email: "legacy@sjsu.edu", googleSubject: null, workspaceKey: "original-workspace", name: "Saved Student", major: "computer-engineering", startingSemester: "Fall 2026" });
  const linked = await service.googleSignIn({ subject: "google-legacy", email: "legacy@sjsu.edu", authoritativeEmail: true });
  assert.equal(linked.user.id, "legacy"); assert.equal(users[1].workspaceKey, "original-workspace");
  await assert.rejects(service.googleSignIn({ subject: "attacker", email: identity.email.replace("student", "changed"), authoritativeEmail: true }), /cannot be linked/);
  users.push({ id: "third-party", email: "someone@example.com", googleSubject: null });
  await assert.rejects(service.googleSignIn({ subject: "third-party-google", email: "someone@example.com", authoritativeEmail: false }), /cannot be linked/);
});
