import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const require = createRequire(new URL("../api/package.json", import.meta.url));
require("dotenv").config({ path: new URL("../api/.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), quiet: true });
const { PrismaClient } = require("./generated/users");
const db = new PrismaClient();
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const browser = await playwright.chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
const origin = process.env.ACCOUNT_PREVIEW || "http://localhost:5175";
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
const token = randomBytes(32).toString("hex"), email = `browser-test-${token.slice(0, 16)}@gmail.com`;
const hash = value => createHash("sha256").update(value).digest("hex");
let user;
mkdirSync("tmp", { recursive: true });
try {
  let unavailable = true;
  await page.route("**/api/v1/auth/google/start", route => route.fulfill({ status: unavailable ? 503 : 201, json: unavailable ? { message: "Google sign-in is not configured yet." } : { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=browser-fixture&scope=openid%20email%20profile" } }));
  await page.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Google redirect reached</h1>" }));
  await page.goto(`${origin}/account`);
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });
  await google.waitFor();
  await page.locator(".cr-page-loading").waitFor({ state: "hidden" });
  assert.equal(await page.locator('input[type="email"]').count(), 0);
  assert.equal(await page.getByText("Email me a sign-in link", { exact: true }).count(), 0);
  await page.getByRole("link", { name: "Continue as guest", exact: true }).waitFor();
  await page.screenshot({ path: "tmp/account-google-only.png", fullPage: true });
  await google.click();
  await page.getByRole("alert").filter({ hasText: "Google sign-in is not configured yet." }).waitFor();
  unavailable = false;
  await google.click();
  await page.waitForURL("https://accounts.google.com/**");
  await page.goto(`${origin}/account?google_error=canceled`);
  await page.getByRole("alert").filter({ hasText: "Google sign-in was canceled" }).waitFor();
  assert.equal(new URL(page.url()).search, "");
  console.log("PASS Google-only UI, failure recovery, redirect and canceled-login feedback (provider mocked)");
  // Seed only a test session; Google authentication itself is covered by the API tests.
  user = await db.user.create({ data: { email, googleSubject: `browser-${token}`, workspaceKey: randomBytes(32).toString("hex"), name: "Browser Student", major: "computer-engineering", startingSemester: "Fall 2026" } });
  await db.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 600000) } });
  await context.addCookies([{ name: "cr_session", value: token, domain: new URL(origin).hostname, path: "/api/v1", httpOnly: true, sameSite: "Lax", secure: origin.startsWith("https:") }]);
  await page.goto(`${origin}/account`);
  await page.getByText(email, { exact: true }).first().waitFor();
  assert.equal((await (await page.request.get(`${origin}/api/v1/auth/me`)).json()).user.id, user.id);
  assert.deepEqual(errors, []);
  console.log("PASS existing account settings and session; no browser runtime errors");
} finally {
  await browser.close();
  if (user) {
    const workspace = await db.personalWorkspace.findUnique({ where: { tokenHash: hash(user.workspaceKey) } });
    if (workspace) { await db.personalOperation.deleteMany({ where: { workspaceId: workspace.id } }); await db.personalWorkspace.delete({ where: { id: workspace.id } }); }
    await db.user.delete({ where: { id: user.id } });
  }
  await db.$disconnect();
}
