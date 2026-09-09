import type { Course, PrerequisiteResult, ScheduleConflict, Section, StudentPlan } from "./types";

export const PLAN_STORAGE_KEY = "course-radar-student-plan-v1";

export function emptyPlan(major: string, catalog: string): StudentPlan {
  return {
    schemaVersion: 1,
    major,
    catalog,
    completedCourseIds: [],
    selectedSectionIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export function parseStoredPlan(value: string | null, major: string, catalog: string): StudentPlan {
  return decodeStudentPlan(value, major, catalog) ?? emptyPlan(major, catalog);
}

export function decodeStudentPlan(value: string | null, major: string, catalog: string): StudentPlan | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StudentPlan>;
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.completedCourseIds) ||
      !Array.isArray(parsed.selectedSectionIds)
    ) return null;
    return {
      schemaVersion: 1,
      major: typeof parsed.major === "string" ? parsed.major : major,
      catalog: typeof parsed.catalog === "string" ? parsed.catalog : catalog,
      completedCourseIds: parsed.completedCourseIds.filter((id): id is string => typeof id === "string"),
      selectedSectionIds: parsed.selectedSectionIds.filter((id): id is string => typeof id === "string"),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function evaluatePrerequisites(course: Course, completedCourseIds: Iterable<string>): PrerequisiteResult {
  const completed = new Set(completedCourseIds);
  const missingCourseIds = course.prerequisiteCourseIds.filter((id) => !completed.has(id));
  return { courseId: course.id, status: missingCourseIds.length ? "unmet" : "met", missingCourseIds };
}

function minutesSinceMidnight(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

export function findScheduleConflicts(selectedSections: Section[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (let left = 0; left < selectedSections.length; left += 1) {
    for (let right = left + 1; right < selectedSections.length; right += 1) {
      for (const firstMeeting of selectedSections[left].meetings) {
        for (const secondMeeting of selectedSections[right].meetings) {
          const firstStart = minutesSinceMidnight(firstMeeting.startTime);
          const firstEnd = minutesSinceMidnight(firstMeeting.endTime);
          const secondStart = minutesSinceMidnight(secondMeeting.startTime);
          const secondEnd = minutesSinceMidnight(secondMeeting.endTime);
          if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) continue;
          for (const day of firstMeeting.days.filter((item) => secondMeeting.days.includes(item))) {
            if (firstStart! < secondEnd! && secondStart! < firstEnd!) {
              conflicts.push({ firstSectionId: selectedSections[left].id, secondSectionId: selectedSections[right].id, day });
            }
          }
        }
      }
    }
  }
  return conflicts;
}
