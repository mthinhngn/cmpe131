import type { Course } from "./types";
import type { Plans, PlanSlot } from "./planning";

/** Completion is independent of placement; both charts show only saved plan entries. */
export function plannerPlacements(courses: Course[], plans: Plans, completed: Set<string>, slots: PlanSlot[]) {
  return courses.flatMap(course => {
    const done = completed.has(course.id);
    const semester = plans[course.id]?.semester;
    return semester !== undefined && slots.includes(semester) ? [{ course, semester, completed: done }] : [];
  });
}
