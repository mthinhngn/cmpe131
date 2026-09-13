import assert from "node:assert/strict";
import test from "node:test";
import type { AgentRequest } from "../src/agent/agent.schemas";
import type { AgentToolsService, ToolExecution } from "../src/agent/agent-tools.service";
import { GeminiAgentService } from "../src/agent/gemini-agent.service";
import type { GeminiCreateInput, GeminiGateway, GeminiInteraction } from "../src/agent/gemini.gateway";
import { z } from "zod";
import { readFileSync } from "node:fs";

const request: AgentRequest = { message: "Check my plan", history: [], program: "computer-engineering", catalogYear: "2026-2027", termId: "fall-2026", completedCourseIds: [], planEntries: [], selectedClassNumbers: [], unavailableTimes: [], preferences: {} };

class FakeGateway {
  inputs: GeminiCreateInput[] = [];
  constructor(private readonly responses: Array<GeminiInteraction | Error>) {}
  isConfigured() { return true; }
  async create(input: GeminiCreateInput) {
    this.inputs.push(input);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Missing fake response");
    return response;
  }
}

class FakeTools {
  calls: string[] = [];
  async ensureCatalogAvailable() {}
  async execute(name: string): Promise<ToolExecution> { this.calls.push(name); return { data: { ok: true }, summary: "Checked." }; }
}

test("returns a safe configuration response when the API key is blank", async () => {
  const gateway = { isConfigured: () => false, create: async () => { throw new Error("should not run"); } };
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, new FakeTools() as unknown as AgentToolsService);
  const response = await service.respond(request);
  assert.equal(response.error?.code, "GEMINI_NOT_CONFIGURED");
  assert.equal(response.proposals.length, 0);
});

test("checked-in agent eval cases cover required safety scenarios", () => {
  const cases = JSON.parse(readFileSync(new URL("./fixtures/agent-evals.json", import.meta.url), "utf8")) as Array<{ id: string }>;
  assert.deepEqual(cases.map((item) => item.id), ["alternate-section-exists", "no-alternate-section", "unavailable-time", "missing-prerequisite", "impossible-full-schedule", "no-fabricated-catalog-data", "no-mutation-without-confirmation", "autonomous-without-planner", "different-course-fallback", "preserve-hard-locks"]);
});

test("executes function calls sequentially and keeps interactions stateless", async () => {
  const gateway = new FakeGateway([
    { steps: [{ type: "function_call", id: "call-1", name: "get_current_plan", arguments: {} }] },
    { output_text: "Your plan is ready to review.", steps: [{ type: "model_output" }] },
  ]);
  const tools = new FakeTools();
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, tools as unknown as AgentToolsService);
  const response = await service.respond(request);
  assert.equal(response.message, "Your plan is ready to review.");
  assert.deepEqual(tools.calls, ["get_current_plan"]);
  assert.equal(gateway.inputs.length, 2);
  assert.equal(gateway.inputs.every((input) => input.store === false), true);
  assert.equal(gateway.inputs[1].input.some((step) => (step as { type?: string }).type === "function_result"), true);
});

test("routes a simple build request through the autonomous scheduler without a follow-up question", async () => {
  const gateway = new FakeGateway([{ output_text: "I built the verified options; review them before applying.", steps: [{ type: "model_output" }] }]);
  const tools = new FakeTools();
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, tools as unknown as AgentToolsService);
  const response = await service.respond({ ...request, message: "Build my Fall 2026 schedule." });
  assert.deepEqual(tools.calls, ["build_autonomous_schedule"]);
  assert.equal(response.activities[0].tool, "build_autonomous_schedule");
  const serializedInput = JSON.stringify(gateway.inputs[0].input);
  assert.match(serializedInput, /already executed the autonomous scheduler/);
});

test("rejects unknown tool names", async () => {
  const gateway = new FakeGateway([{ steps: [{ type: "function_call", id: "call-1", name: "run_sql", arguments: {} }] }]);
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, new FakeTools() as unknown as AgentToolsService);
  assert.equal((await service.respond(request)).error?.code, "MALFORMED_TOOL_CALL");
});

test("rejects malformed tool arguments before execution", async () => {
  const gateway = new FakeGateway([{ steps: [{ type: "function_call", id: "call-1", name: "search_sections", arguments: { courseIds: "not-an-array" } }] }]);
  const malformedTools = { ensureCatalogAvailable: async () => {}, execute: async () => z.object({ courseIds: z.array(z.string()) }).parse({ courseIds: "not-an-array" }) };
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, malformedTools as unknown as AgentToolsService);
  assert.equal((await service.respond(request)).error?.code, "MALFORMED_TOOL_CALL");
});

test("enforces the maximum function-call count", async () => {
  const previous = process.env.AGENT_MAX_TOOL_CALLS;
  process.env.AGENT_MAX_TOOL_CALLS = "2";
  try {
    const call = (id: string): GeminiInteraction => ({ steps: [{ type: "function_call", id, name: "get_current_plan", arguments: {} }] });
    const service = new GeminiAgentService(new FakeGateway([call("1"), call("2"), call("3")]) as unknown as GeminiGateway, new FakeTools() as unknown as AgentToolsService);
    assert.equal((await service.respond(request)).error?.code, "TOOL_LOOP_EXHAUSTED");
  } finally {
    if (previous === undefined) delete process.env.AGENT_MAX_TOOL_CALLS; else process.env.AGENT_MAX_TOOL_CALLS = previous;
  }
});

test("maps free-tier 429 responses without exposing provider details", async () => {
  const providerError = Object.assign(new Error("provider detail"), { status: 429 });
  const service = new GeminiAgentService(new FakeGateway([providerError]) as unknown as GeminiGateway, new FakeTools() as unknown as AgentToolsService);
  const response = await service.respond(request);
  assert.equal(response.error?.code, "GEMINI_RATE_LIMITED");
  assert.equal(response.message.includes("provider detail"), false);
});

test("returns catalog-unavailable before calling Gemini when PostgreSQL cannot be checked", async () => {
  const gateway = new FakeGateway([{ output_text: "should not run" }]);
  const tools = { ensureCatalogAvailable: async () => { throw new Error("Catalog database is unavailable"); }, execute: async () => ({ data: {}, summary: "" }) };
  const service = new GeminiAgentService(gateway as unknown as GeminiGateway, tools as unknown as AgentToolsService);
  const response = await service.respond(request);
  assert.equal(response.error?.code, "CATALOG_UNAVAILABLE");
  assert.equal(gateway.inputs.length, 0);
});
