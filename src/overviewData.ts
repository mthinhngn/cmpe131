import type { ProgramCatalog } from "./types";

export function overviewData(catalog: ProgramCatalog, taken: Set<string>, plans: Record<string, { semester: number; status: "planned" | "in-progress" }>) {
  const requiredIds = new Set(catalog.requirementGroups.flatMap(group => group.items.flatMap(item => item.courseId ? [item.courseId] : [])));
  const required = catalog.courses.filter(course => requiredIds.has(course.id));
  const completed = required.filter(course => taken.has(course.id));
  const active = required.filter(course => !taken.has(course.id) && plans[course.id]);
  const upcoming = required.filter(course => !taken.has(course.id) && !plans[course.id])
    .sort((a, b) => a.recommendedSemester - b.recommendedSemester || a.code.localeCompare(b.code));
  const completedUnits = completed.reduce((sum, course) => sum + course.units, 0);
  const activeUnits = active.reduce((sum, course) => sum + course.units, 0);
  const coreUnits = required.reduce((sum, course) => sum + course.units, 0);
  return { required, completed, active, upcoming, completedUnits, activeUnits, coreUnits,
    percent: required.length ? Math.round(completed.length / required.length * 100) : 0 };
}
