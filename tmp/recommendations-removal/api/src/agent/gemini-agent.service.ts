import { Injectable } from "@nestjs/common";
import { ZodError } from "zod";
import { agentRequestSchema, type AgentErrorCode, type AgentRequest, type AgentResponse, type ScheduleProposal } from "./agent.schemas";
import { AGENT_TOOL_NAMES, GEMINI_TOOLS, AgentToolsService, type AgentToolName } from "./agent-tools.service";
import { GeminiGateway, type GeminiFunctionCall, type GeminiStep } from "./gemini.gateway";

const TOOL_LABELS: Record<AgentToolName, string> = {
  get_current_plan: "Checking your planner",
  get_course_requirements: "Reviewing prerequisites",
  search_sections: "Searching Fall 2026 sections",
  find_alternative_sections: "Looking for another section",
  generate_schedule_candidates: "Building schedule options",
  validate_schedule: "Validating the schedule",
  build_autonomous_schedule: "Building from your degree path",
};

const SYSTEM_INSTRUCTION = `You are Course Radar's scheduling assistant for a course-project demo.
Use the supplied read-only functions for every factual claim about the student's plan, prerequisites, courses, sections, seat snapshots, professors, rooms, time conflicts, or schedule proposals. Never invent catalog facts.
The application—not you—calculates conflicts, unavailable-time conflicts, prerequisite groups, component combinations, and rankings. Preserve the component when requesting an alternative section. Ordinary prerequisites require completed courses; same-term courses satisfy only explicit corequisites. Grades and manual-review rules are warnings.
For any request to build, create, recommend, repair, or replace a schedule, use build_autonomous_schedule. Do not ask which semester or courses: the tool derives them from the official roadmap, completed courses, current term, optional planner, and hard-locked current sections. If there is no planner and no completed course, accept the tool's new-student assumption. Existing selected sections are hard locks. New sections must have open seats. If a preferred course cannot fit or has no open section, the tool backtracks to another eligible graduation-progress course.
TBA/unparseable meetings are uncertain, never confirmed conflict-free. Multi-component pairings require manual review. The user must confirm in the UI before browser schedule state changes. Do not claim that you applied a schedule.
This is not an official degree audit or live enrollment system. Keep responses under 300 words.`;

function isAutonomousSchedulingRequest(message: string) {
  return /\b(build|create|make|generate|recommend|repair)\b[^.!?]{0,80}\b(schedule|classes|courses)\b/i.test(message)
    || /\b(no|don't have|do not have)\b[^.!?]{0,60}\bschedule\b/i.test(message)
    || /\b(replace|replacement|swap)\b[^.!?]{0,80}\b(class|course|schedule)\b/i.test(message);
}

function isFunctionCall(step: GeminiStep): step is GeminiFunctionCall {
  return step.type === "function_call" && typeof step.id === "string" && typeof step.name === "string";
}

function responseForError(code: AgentErrorCode): AgentResponse {
  const messages: Record<AgentErrorCode, string> = {
    GEMINI_NOT_CONFIGURED: "Gemini is not configured yet. Add GEMINI_API_KEY to api/.env, then restart the API. Your manual planner and schedule builder still work.",
    GEMINI_AUTHENTICATION_FAILED: "Gemini rejected the configured API key. Check the key in api/.env and restart the API.",
    GEMINI_RATE_LIMITED: "The Gemini free-tier quota is temporarily exhausted. Try again after the quota resets; your manual planner and schedule builder are unchanged.",
    GEMINI_NETWORK_ERROR: "Course Radar could not reach Gemini. Check the API server's network connection and try again.",
    GEMINI_REFUSAL: "Gemini could not answer this request. Try rephrasing it without personal or sensitive information.",
    MALFORMED_TOOL_CALL: "Gemini returned an invalid scheduling-tool request, so Course Radar did not execute it. Please try again.",
    TOOL_LOOP_EXHAUSTED: "The scheduling assistant reached its tool-call safety limit before finishing. Narrow the request to fewer courses and try again.",
    CATALOG_UNAVAILABLE: "The PostgreSQL catalog is unavailable, so the assistant cannot verify courses or sections. The manual planner remains available.",
    AGENT_UNAVAILABLE: "The scheduling assistant is temporarily unavailable. Please try again; no schedule changes were made.",
  };
  const retryable = ["GEMINI_RATE_LIMITED", "GEMINI_NETWORK_ERROR", "CATALOG_UNAVAILABLE", "AGENT_UNAVAILABLE"].includes(code);
  return { message: messages[code], activities: [], proposals: [], warnings: [], error: { code, retryable } };
}

@Injectable()
export class GeminiAgentService {
  constructor(private readonly gateway: GeminiGateway, private readonly tools: AgentToolsService) {}

  parseRequest(input: unknown) {
    return agentRequestSchema.parse(input);
  }

  async respond(context: AgentRequest): Promise<AgentResponse> {
    if (!this.gateway.isConfigured()) return responseForError("GEMINI_NOT_CONFIGURED");
    const transcript = context.history.map((turn) => `${turn.role === "user" ? "Student" : "Assistant"}: ${turn.content}`).join("\n");
    let prompt = `${transcript ? `Recent session conversation:\n${transcript}\n\n` : ""}Current student message: ${context.message}`;
    const history: unknown[] = [];
    const activities: AgentResponse["activities"] = [];
    const proposalMap = new Map<string, ScheduleProposal>();
    const warnings = new Set<string>();
    let decisionTrace: AgentResponse["decisionTrace"];
    const configuredLimit = Number(process.env.AGENT_MAX_TOOL_CALLS ?? "6");
    const maxCalls = Math.min(6, Math.max(1, Number.isFinite(configuredLimit) ? Math.floor(configuredLimit) : 6));
    let executedCalls = 0;

    try {
      await this.tools.ensureCatalogAvailable(context);
      if (isAutonomousSchedulingRequest(context.message)) {
        const result = await this.tools.execute("build_autonomous_schedule", { requiredCourseCodes: [], avoidDays: [], minimumUnits: 12, targetUnits: 15, maxResults: 3 }, context);
        activities.push({ tool: "build_autonomous_schedule", label: TOOL_LABELS.build_autonomous_schedule, summary: result.summary });
        result.proposals?.forEach((proposal) => proposalMap.set(proposal.id, proposal));
        result.warnings?.forEach((warning) => warnings.add(warning));
        decisionTrace = result.decisionTrace;
        prompt += `\n\nThe application already executed the autonomous scheduler. Explain this verified result directly; do not ask a follow-up question:\n${JSON.stringify(result.data)}`;
      }
      history.push({ type: "user_input", content: [{ type: "text", text: prompt }] });
      while (true) {
        const interaction = await this.gateway.create({
          model: process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
          input: history,
          system_instruction: SYSTEM_INSTRUCTION,
          tools: [...GEMINI_TOOLS],
          store: false,
          generation_config: { temperature: 0.2, max_output_tokens: 1_200 },
        });
        const steps = interaction.steps ?? [];
        history.push(...steps);
        const calls = steps.filter(isFunctionCall);
        if (!calls.length) {
          const message = interaction.output_text?.trim();
          if (!message) return responseForError("GEMINI_REFUSAL");
          return { message, activities, proposals: [...proposalMap.values()].slice(0, 3), warnings: [...warnings], decisionTrace };
        }

        for (const call of calls) {
          if (executedCalls >= maxCalls) return { ...responseForError("TOOL_LOOP_EXHAUSTED"), activities, proposals: [...proposalMap.values()].slice(0, 3), warnings: [...warnings] };
          executedCalls += 1;
          if (!AGENT_TOOL_NAMES.includes(call.name as AgentToolName)) return { ...responseForError("MALFORMED_TOOL_CALL"), activities, warnings: [...warnings] };
          const name = call.name as AgentToolName;
          try {
            const result = await this.tools.execute(name, call.arguments, context);
            activities.push({ tool: name, label: TOOL_LABELS[name], summary: result.summary });
            result.proposals?.forEach((proposal) => proposalMap.set(proposal.id, proposal));
            result.warnings?.forEach((warning) => warnings.add(warning));
            if (result.decisionTrace) decisionTrace = result.decisionTrace;
            history.push({ type: "function_result", call_id: call.id, name, result: JSON.stringify(result.data) });
          } catch (error) {
            if (error instanceof ZodError || (error instanceof Error && error.message.startsWith("Invalid "))) {
              return { ...responseForError("MALFORMED_TOOL_CALL"), activities, warnings: [...warnings] };
            }
            throw error;
          }
        }
      }
      return { ...responseForError("TOOL_LOOP_EXHAUSTED"), activities, proposals: [...proposalMap.values()].slice(0, 3), warnings: [...warnings] };
    } catch (error) {
      const code = this.mapError(error);
      return { ...responseForError(code), activities, proposals: [...proposalMap.values()].slice(0, 3), warnings: [...warnings] };
    }
  }

  private mapError(error: unknown): AgentErrorCode {
    if (error && typeof error === "object" && "agentCode" in error && error.agentCode === "GEMINI_NOT_CONFIGURED") return "GEMINI_NOT_CONFIGURED";
    const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const status = Number(record.status ?? record.statusCode ?? 0);
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (status === 401 || status === 403 || message.includes("api key") || message.includes("unauthenticated")) return "GEMINI_AUTHENTICATION_FAILED";
    if (status === 429 || message.includes("quota") || message.includes("rate limit") || message.includes("resource_exhausted")) return "GEMINI_RATE_LIMITED";
    if (message.includes("prisma") || message.includes("database") || (message.includes("connect") && message.includes("postgres"))) return "CATALOG_UNAVAILABLE";
    if (message.includes("fetch failed") || message.includes("network") || message.includes("enotfound") || message.includes("econn")) return "GEMINI_NETWORK_ERROR";
    return "AGENT_UNAVAILABLE";
  }
}
