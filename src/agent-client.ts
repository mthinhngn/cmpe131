import type { PlanSlot } from "./academicProfile";
/** Browser/server contract: commands are applied locally, then acknowledged. */
export type AgentContext = {
  additional_program_ids?: string[];
  program_id: string; page: string; selected_course_id: string | null;
  completed_course_ids: string[];
  plan: { course_id: string; semester_slot: PlanSlot; status: "planned" | "in-progress" }[];
  term_to_slot: Record<string, number>; revision: string; semester_count: number;
  starting_term: string | null; named_terms: string[]; semester_slots?: number[]; workspace_revision?: number;
  capabilities?: ("apply_plan_changes" | "set_course_sections")[];
  selected_sections?: Record<string, string[]>;
};
export type CourseAction = {
  kind: "open_course" | "add_course_to_plan" | "remove_course_from_plan" | "move_course_in_plan"; course_id: string; course_code: string;
  action_id: string; tool_call_id: string; expected_revision: string; program_id: string;
  semester_slot?: PlanSlot; target_term?: { season: string; year: number };
  source_semester_slot?: PlanSlot | null; previous_semester_slot?: PlanSlot;
  previous_status?: "planned" | "in-progress";
};
export type PlanGroupAction = {
  kind: "apply_plan_changes"; operation: "swap" | "replace";
  action_id: string; tool_call_id: string; expected_revision: string; program_id: string;
  changes: CourseAction[];
};
export type SectionAction = {
  kind: "set_course_sections"; action_id: string; tool_call_id: string;
  expected_revision: string; program_id: string; course_id: string;
  term: string; class_numbers: string[];
};
export type BrowserAction = CourseAction | PlanGroupAction | SectionAction;
export type ConversationItem = { query: string; request: AgentRequest };
export type Receipt = { status: "succeeded" | "failed"; code: string; message: string; context: AgentContext };
export type AgentSession = { kind: "guest" | "account"; namespace: string; latest_thread_id?: string | null };
export type AgentRequest = {
  request_id: string; status: "queued" | "needs_context" | "running" | "awaiting_action" | "completed" | "failed";
  reply: string; action: BrowserAction | null;
  events: { node: string; detail: string; at?: string }[]; trace_id: string;
  clarification?: "starting_term" | null;
  preferences?: Record<string, unknown>;
  memory_status?: "saved" | "browser_save_required" | "failed";
  web_handoff?: { current_term: { season: string; year: number } | null; error_code: string | null; citations: { source_id: string; title: string; url: string; retrieved_at: string }[] } | null;
};
export function contextRevision(context: Omit<AgentContext, "revision">): string {
  return JSON.stringify({ ...context, capabilities: [...(context.capabilities ?? [])].sort(), selected_sections: Object.fromEntries(Object.entries(context.selected_sections ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([term, ids]) => [term, [...ids].sort()])), completed_course_ids: [...context.completed_course_ids].sort(), named_terms: [...context.named_terms].sort(), plan: [...context.plan].sort((a, b) => a.course_id.localeCompare(b.course_id)), term_to_slot: Object.fromEntries(Object.entries(context.term_to_slot).sort(([a], [b]) => a.localeCompare(b))) });
}
export class AgentError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
let sessionRequest: Promise<AgentSession> | undefined;
export function agentSession(force = false): Promise<AgentSession> {
  if (!sessionRequest || force) {
    const pending = agentFetch<AgentSession>("/session", {});
    sessionRequest = pending;
    void pending.finally(() => { if (sessionRequest === pending) sessionRequest = undefined; }).catch(() => {});
  }
  return sessionRequest;
}
export async function agentFetch<T>(path: string, data?: unknown): Promise<T> {
  // Keep account cookies scoped to /api/v1; Vite forwards this prefix to Python.
  const base = (import.meta.env.VITE_AGENT_URL || "/api/v1/agent").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, { credentials: "same-origin", cache: "no-store", method: data === undefined ? "GET" : "POST", headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new AgentError(typeof payload?.detail === "string" ? payload.detail : `Agent service returned ${response.status}. Check that it is running.`, response.status);
  }
  return response.json() as Promise<T>;
}
