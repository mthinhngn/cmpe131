import type { CourseOffering } from "./types";
import type { MeetingDay } from "./schedule";

export type AgentHistoryTurn = { role: "user" | "assistant"; content: string };
export type UnavailableWindow = { day: MeetingDay; startMinute: number; endMinute: number };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; response?: AgentResponse };

export type ScheduleDecisionTrace = {
  assumedNewStudent: boolean;
  targetUnits: number;
  minimumUnits: number;
  lockedClassNumbers: string[];
  eligibleCourses: Array<{ courseId: string; courseCode: string; units: number; roadmapSemester: number; downstreamUnlocks: number }>;
  rejectedCourses: Array<{ courseId: string; courseCode: string; reason: string }>;
  replacements: Array<{ skippedCourseCode: string; chosenCourseCode: string; reason: string }>;
  examinedCombinations: number;
};

export type ScheduleProposal = {
  id: string;
  title: string;
  sections: Array<CourseOffering & { courseId: string; source?: "locked" | "new" | "replacement" }>;
  warnings: string[];
  metrics: { campusDays: number; gapMinutes: number; closedSections: number; totalUnits?: number };
  lockedClassNumbers?: string[];
  decisionTrace?: ScheduleDecisionTrace;
};

export type AgentResponse = {
  message: string;
  activities: Array<{ tool: string; label: string; summary: string }>;
  proposals: ScheduleProposal[];
  warnings: string[];
  decisionTrace?: ScheduleDecisionTrace;
  error?: { code: string; retryable: boolean };
};

export async function sendAgentMessage(input: Record<string, unknown>, signal?: AbortSignal): Promise<AgentResponse> {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
  const response = await fetch(`${apiUrl}/agent/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const payload = await response.json().catch(() => null) as AgentResponse | { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message || `Agent API returned ${response.status}`);
  if (!payload || typeof payload !== "object" || !("message" in payload) || !("proposals" in payload)) throw new Error("Agent API returned an invalid response");
  return payload as AgentResponse;
}
