import type { Course } from "./types";

type Plans = Record<string, { status: "planned" | "in-progress"; semester: number }>;
export type RoadmapStatus = "complete" | "current" | "available" | "needs-prerequisites" | "review" | "choice";

export const roadmapStatusLabels: Record<RoadmapStatus, string> = {
  complete: "Completed",
  current: "In progress",
  available: "Ready to plan",
  "needs-prerequisites": "Prerequisites needed",
  review: "Check requirements",
  choice: "Requirement choice",
};

/** Session progress is explicit; recorded conditions are never treated as verified grades/placement. */
export function roadmapStatus(course: Course, completed: Set<string>, plans: Plans): RoadmapStatus {
  if (completed.has(course.id)) return "complete";
  if (plans[course.id]?.status === "in-progress") return "current";
  if (course.prerequisiteCourseIds.some(id => !completed.has(id))) return "needs-prerequisites";
  const semester = plans[course.id]?.semester;
  if (course.corequisiteCourseIds.some(id => !completed.has(id) && (!semester || plans[id]?.semester !== semester))) return "review";
  if (course.prerequisiteText?.trim()) return "review";
  return "available";
}
