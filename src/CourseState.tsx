import { ArrowCircleRight, CalendarBlank, CheckCircle, Clock, LockSimple, WarningDiamond } from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import type { Course } from "./types";

export type CourseState = "completed" | "in-progress" | "planned" | "available" | "blocked" | "missing-prerequisite";

export const courseStateLabels: Record<CourseState, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  planned: "Planned",
  available: "Available",
  blocked: "Blocked",
  "missing-prerequisite": "Missing prerequisite",
};

export function useCourseState(course: Course): CourseState {
  const { courseById, plans, takenCourseIds } = useCatalog();
  if (takenCourseIds.has(course.id)) return "completed";
  if (plans[course.id]?.status === "in-progress") return "in-progress";
  if (plans[course.id]?.status === "planned") return "planned";
  if (course.prerequisiteCourseIds.some(id => !courseById.has(id))) return "missing-prerequisite";
  if (course.prerequisiteCourseIds.every(id => takenCourseIds.has(id))) return "available";
  return "blocked";
}

export function CourseStateBadge({ course, compact = false }: { course: Course; compact?: boolean }) {
  const state = useCourseState(course);
  const Icon = state === "completed" ? CheckCircle
    : state === "in-progress" ? Clock
      : state === "planned" ? CalendarBlank
        : state === "available" ? ArrowCircleRight
          : state === "blocked" ? LockSimple
            : WarningDiamond;
  return <span className={`course-status ${state}`} data-compact={compact || undefined}><Icon size={compact ? 12 : 14} aria-hidden="true" />{courseStateLabels[state]}</span>;
}
