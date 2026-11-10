import test from "node:test";
import assert from "node:assert/strict";
import { deliverySettings, sendSignInEmail, validateRecipient } from "../src/auth/email-delivery";

test("local delivery requires configuration, own test inbox and localhost", t => {
  const names = ["AUTH_DELIVERY", "AUTH_WEB_ORIGIN", "NODE_ENV", "RESEND_API_KEY", "AUTH_TEST_EMAIL", "AUTH_EMAIL_FROM", "WEB_ORIGIN"];
  const previous = Object.fromEntries(names.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of names) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  process.env.NODE_ENV = "development";
  process.env.AUTH_DELIVERY = "resend";
  delete process.env.AUTH_EMAIL_FROM;
  process.env.AUTH_WEB_ORIGIN = "http://localhost:5175";
  delete process.env.RESEND_API_KEY;
  delete process.env.AUTH_TEST_EMAIL;
  assert.throws(deliverySettings, /not configured/);
  process.env.RESEND_API_KEY = "re_test_not_real";
  process.env.AUTH_TEST_EMAIL = " Student@SJSU.edu ";
  const config = deliverySettings();
  assert.equal(config.mode, "resend");
  assert.doesNotThrow(() => validateRecipient(config, "student@sjsu.edu"));
  assert.throws(() => validateRecipient(config, "someone@example.com"), /limited to the inbox/);
  for (const url of ["https://cmpe131.vercel.app", "http://localhost.evil.example", "ftp://localhost", "http://user:password@localhost"]) {
    process.env.AUTH_WEB_ORIGIN = url;
    assert.throws(deliverySettings, /localhost/);
  }
  process.env.AUTH_WEB_ORIGIN = "invalid";
  assert.throws(deliverySettings, /return address/);
  process.env.AUTH_WEB_ORIGIN = "http://localhost:5175";
  process.env.NODE_ENV = "production";
  assert.throws(deliverySettings, /approved HTTPS/);
  process.env.AUTH_WEB_ORIGIN = "https://cmpe131.vercel.app";
  process.env.WEB_ORIGIN = "https://cmpe131.vercel.app";
  assert.equal(deliverySettings().mode, "resend", "production supports the explicitly approved origin");
  delete process.env.AUTH_TEST_EMAIL;
  assert.throws(deliverySettings, /not configured/);
  process.env.AUTH_EMAIL_FROM = "Course Radar <login@courses.example.com>";
  const publicDelivery = deliverySettings();
  assert.doesNotThrow(() => validateRecipient(publicDelivery, "student@sjsu.edu"));
  for (const url of ["http://cmpe131.vercel.app", "https://untrusted.example", "https://cmpe131.vercel.app/account", "https://cmpe131.vercel.app/?next=evil"]) {
    process.env.AUTH_WEB_ORIGIN = url;
    assert.throws(deliverySettings, /approved HTTPS/);
  }
  process.env.AUTH_WEB_ORIGIN = "https://cmpe131.vercel.app";
  process.env.AUTH_DELIVERY = "log";
  assert.throws(deliverySettings, /not configured/);
});

test("Resend delivery sends a localhost link and rejects failures without leaking provider details", async t => {
  const settings = { mode: "resend" as const, origin: new URL("http://localhost:5175"), apiKey: "re_test_not_real", recipient: "student@example.com" };
  const url = new URL("/account#token=private-test-token", settings.origin);
  const sent: { url: string; init?: RequestInit }[] = [];
  const mocked = t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return new Response(JSON.stringify({ id: "test-email-id" }), { status: 200 });
  });
  await sendSignInEmail(settings, settings.recipient, url);
  assert.equal(sent[0].url, "https://api.resend.com/emails");
  assert.equal(sent[0].init?.redirect, "error");
  const body = JSON.parse(sent[0].init?.body as string);
  assert.equal(body.from, "Course Radar <onboarding@resend.dev>");
  assert.deepEqual(body.to, [settings.recipient]);
  assert.ok(body.text.includes(url.href));
  assert.match(body.text, /15 minutes/);
  assert.ok(sent[0].init?.signal);
  for (const status of [401, 403, 429, 500]) {
    mocked.mock.mockImplementation(async () => new Response("private-test-token re_test_not_real sensitive-provider-detail", { status }));
    await assert.rejects(sendSignInEmail(settings, settings.recipient, url), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /could not be confirmed/);
      assert.doesNotMatch(error.message, /private-test-token|re_test_not_real|sensitive-provider-detail/);
      return true;
    });
  }
  mocked.mock.mockImplementation(async () => { throw new Error("network timeout secret"); });
  await assert.rejects(sendSignInEmail(settings, settings.recipient, url), /could not be confirmed/);
  mocked.mock.mockImplementation(async () => new Response("{}", { status: 200 }));
  await assert.rejects(sendSignInEmail(settings, settings.recipient, url), /could not be confirmed/);
});
