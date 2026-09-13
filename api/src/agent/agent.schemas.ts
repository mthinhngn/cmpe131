import { z } from "zod";

export const meetingDaySchema = z.enum(["M", "T", "W", "R", "F", "S", "U"]);

const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
}).strict();

const planEntrySchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  semester: z.number().int().min(1).max(16),
  status: z.enum(["planned", "in-progress"]),
}).strict();

export const unavailableWindowSchema = z.object({
  day: meetingDaySchema,
  startMinute: z.number().int().min(0).max(1_439),
  endMinute: z.number().int().min(1).max(1_440),
}).strict().refine((window) => window.endMinute > window.startMinute, {
  message: "endMinute must be later than startMinute",
});

export const agentRequestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(historyTurnSchema).max(8).default([]),
  program: z.string().trim().min(1).max(80),
  catalogYear: z.string().trim().min(1).max(20),
  termId: z.string().trim().min(1).max(80),
  completedCourseIds: z.array(z.string().trim().min(1).max(100)).max(200).default([]),
  planEntries: z.array(planEntrySchema).max(200).default([]),
  selectedClassNumbers: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  unavailableTimes: z.array(unavailableWindowSchema).max(30).default([]),
  preferences: z.object({
    earliestStartMinute: z.number().int().min(0).max(1_439).optional(),
    latestEndMinute: z.number().int().min(1).max(1_440).optional(),
  }).strict().default({}),
}).strict();

export const courseIdsArgsSchema = z.object({
  courseIds: z.array(z.string().trim().min(1).max(100)).min(1).max(12),
}).strict();

export const searchSectionsArgsSchema = z.object({
  courseIds: z.array(z.string().trim().min(1).max(100)).min(1).max(12),
  component: z.string().trim().min(1).max(20).optional(),
  openOnly: z.boolean().default(false),
}).strict();

export const alternativeSectionsArgsSchema = z.object({
  classNumber: z.string().trim().min(1).max(40),
}).strict();

export const generateCandidatesArgsSchema = z.object({
  courseIds: z.array(z.string().trim().min(1).max(100)).min(1).max(8),
  maxResults: z.number().int().min(1).max(3).default(3),
}).strict();

export const validateScheduleArgsSchema = z.object({
  classNumbers: z.array(z.string().trim().min(1).max(40)).min(1).max(40),
}).strict();

export const buildAutonomousScheduleArgsSchema = z.object({
  requiredCourseCodes: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  avoidDays: z.array(meetingDaySchema).max(7).default([]),
  minimumUnits: z.number().int().min(1).max(18).default(12),
  targetUnits: z.number().int().min(1).max(18).default(15),
  maxResults: z.number().int().min(1).max(3).default(3),
}).strict().refine((value) => value.targetUnits >= value.minimumUnits, {
  message: "targetUnits must be greater than or equal to minimumUnits",
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type UnavailableWindow = z.infer<typeof unavailableWindowSchema>;

export type AgentErrorCode =
  | "GEMINI_NOT_CONFIGURED"
  | "GEMINI_AUTHENTICATION_FAILED"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_NETWORK_ERROR"
  | "GEMINI_REFUSAL"
  | "MALFORMED_TOOL_CALL"
  | "TOOL_LOOP_EXHAUSTED"
  | "CATALOG_UNAVAILABLE"
  | "AGENT_UNAVAILABLE";

export type AgentSection = {
  instructors: string[];
  courseCode: string;
  courseId: string;
  sectionNumber: string;
  classNumber: string;
  mode: string;
  component: string;
  days: string;
  times: string;
  location: string;
  dates: string;
  openSeats: number;
  source?: "locked" | "new" | "replacement";
};

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
  sections: AgentSection[];
  warnings: string[];
  metrics: {
    campusDays: number;
    gapMinutes: number;
    closedSections: number;
    totalUnits?: number;
  };
  lockedClassNumbers?: string[];
  decisionTrace?: ScheduleDecisionTrace;
};

export type AgentActivity = {
  tool: string;
  label: string;
  summary: string;
};

export type AgentResponse = {
  message: string;
  activities: AgentActivity[];
  proposals: ScheduleProposal[];
  warnings: string[];
  decisionTrace?: ScheduleDecisionTrace;
  error?: { code: AgentErrorCode; retryable: boolean };
};
