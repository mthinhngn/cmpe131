import type { PlanningStore } from "./planning-engine";
import type { CourseOffering } from "./course-types";
import { termFor, type SectionData } from "./schedule-sync";

/** Validate published sections before one authenticated workspace commit. */
export function applyAgentSections(store: PlanningStore, input: Record<string, any>, data: SectionData | null, profileStart?: string) {
  const action = input.action, before = store.getState();
  const fail = (message: string): never => { throw new Error(message); };
  let expected;
  try { expected = JSON.parse(action.expected_revision); } catch { return fail("Invalid action context."); }
  if (!input.browserFresh || expected.workspace_revision !== before.revision || action.program_id !== before.program) fail("The saved plan changed. No sections were changed.");
  const course = before.catalog.courses.find(c => c.id === action.course_id);
  const plan = store.plans[action.course_id];
  const start = profileStart ?? before.startingTerms?.[before.program];
  if (!course || !plan || termFor(start, plan.semester) !== action.term || before.completed.includes(course.id)) fail("The course must be planned in the requested semester first.");
  if (!data || data.status !== "available" || data.term !== action.term) fail("Official sections are unavailable.");
  const ids = action.class_numbers;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) fail("Invalid section selection.");
  const key = `${before.program}:${before.catalog.catalogYear}:${action.term}`;
  const rows = data!.offerings, same = rows.filter(o => o.courseCode === course!.code);
  const old = before.schedules[key] ?? [];
  const sameIds = new Set(same.map(o => o.classNumber));
  const others = old.filter(id => !sameIds.has(id)).sort();
  if (JSON.stringify(ids.filter((id: string) => !sameIds.has(id)).sort()) !== JSON.stringify(others)) fail("Unrelated course sections must be preserved.");
  const selected: CourseOffering[] = ids.map((id: string) => rows.find(o => o.classNumber === id) ?? fail("A selected section is no longer published."));
  if (selected.some(o => o.scheduleReview)) fail("Section details require review with SJSU before selection.");
  const chosen = selected.filter(o => o.courseCode === course!.code);
  const components = [...new Set(same.map(o => o.component))];
  if (!components.length || chosen.length !== components.length || components.some(component => chosen.filter(o => o.component === component).length !== 1)) fail("Choose one section for every required component.");
  const meetings = selected.flatMap(o => {
    const days = o.days.split("/"), times = o.times.split("/");
    if (days.length === 1 && times.length > 1) while (days.length < times.length) days.push(days[0]);
    if (days.length !== times.length) return fail("Meeting patterns need review.");
    return times.map((time, i) => {
      const match = /^(\d{1,2}):(\d{2})(AM|PM)\s*-\s*(\d{1,2}):(\d{2})(AM|PM)$/i.exec(time.trim());
      if (!match || !/^[MTWRFSU]+$/.test(days[i].trim())) return fail("Unknown meeting times require manual review.");
      const clock = (h: string, m: string, p: string) => {
        if (+h < 1 || +h > 12 || +m > 59) return fail("Invalid meeting time.");
        return (+h % 12 + (p.toUpperCase() === "PM" ? 12 : 0)) * 60 + +m;
      };
      const start = clock(match[1], match[2], match[3]), end = clock(match[4], match[5], match[6]);
      if (start >= end) return fail("Invalid meeting range.");
      return { days: days[i].trim(), start, end };
    });
  });
  if (meetings.some((a, i) => meetings.slice(i + 1).some(b => [...a.days].some(d => b.days.includes(d)) && a.start < b.end && b.start < a.end))) fail("The selected sections overlap.");
  store.restore({ ...before, schedules: { ...before.schedules, [key]: ids }, scheduleOfferings: { ...before.scheduleOfferings, [key]: selected }, revision: before.revision + 1 });
}
