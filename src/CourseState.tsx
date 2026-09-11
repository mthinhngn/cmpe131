import { CalendarBlank, CheckCircle, Circle, Clock, Minus, WarningDiamond } from "@phosphor-icons/react";
import { useCatalog } from "./CatalogContext";
import type { Course } from "./types";

export type CourseState = "taken" | "completed" | "in-progress" | "planned" | "open" | "closed" | "missing-prerequisite";

export const courseStateLabels: Record<CourseState, string> = {
  taken: "Already taken",
  completed: "Completed",
  "in-progress": "In progress",
  planned: "Planned",
  open: "Open",
  closed: "Closed",
  "missing-prerequisite": "Missing prerequisite",
};

export function useCourseState(course: Course): CourseState {
  const { courseById, plans, takenCourseIds } = useCatalog();
  if (takenCourseIds.has(course.id)) return "taken";
  if (plans[course.id]?.status === "in-progress") return "in-progress";
  if (plans[course.id]?.status === "planned") return "planned";
  if (course.prerequisiteCourseIds.some(id => !courseById.has(id))) return "missing-prerequisite";
  if (course.prerequisiteCourseIds.every(id => takenCourseIds.has(id))) return "open";
  return "closed";
}

export function CourseStateBadge({ course, compact = false }: { course: Course; compact?: boolean }) {
  const state = useCourseState(course);
  const Icon = state === "taken" ? Minus
    : state === "completed" ? CheckCircle
    : state === "in-progress" ? Clock
      : state === "planned" ? CalendarBlank
        : state === "open" || state === "closed" ? Circle
            : WarningDiamond;
  const weight = state === "open" || state === "closed" ? "fill" : "regular";
  return <span className={`course-status ${state}`} data-compact={compact || undefined}><Icon size={compact ? 9 : 10} weight={weight} aria-hidden="true" />{courseStateLabels[state]}</span>;
}
