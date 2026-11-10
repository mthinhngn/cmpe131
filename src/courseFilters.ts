import { parseMeeting, type MeetingDay, type ParsedMeeting } from "./schedule.ts";
import type { Course, CourseOffering } from "./types.ts";

export type CourseFilters = {
  scope: "all" | "degree" | "scheduled";
  subjects: string[];
  offered: boolean;
  availability: "any" | "open" | "full" | "unknown";
  modes: string[];
  days: string[];
  after: string;
  before: string;
  meeting: "any" | "scheduled" | "unscheduled" | "review";
  includeUnknown: boolean;
  minUnits: string;
  maxUnits: string;
  instructor: string;
  components: string[];
  year: "any" | "early" | "late";
};
export const DEFAULT_FILTERS: CourseFilters = { scope: "all", subjects: [], offered: false, availability: "any", modes: [], days: [], after: "", before: "", meeting: "any", includeUnknown: false, minUnits: "", maxUnits: "", instructor: "", components: [], year: "any" };
const keys = Object.keys(DEFAULT_FILTERS) as (keyof CourseFilters)[];
const oneOf = <T extends string>(value: string | null, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const values = (p: URLSearchParams, key: string) => [...new Set((p.get(key) ?? "").split(",").map(v => v.trim().toUpperCase()).filter(Boolean))];
const time = (v: string | null) => v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "";
const units = (v: string | null) => v && /^\d{1,2}(\.\d{1,2})?$/.test(v) ? String(Number(v)) : "";
export function readCourseFilters(p: URLSearchParams): CourseFilters {
  const legacy = p.get("status");
  return {
    scope: oneOf(p.get("scope"), ["all", "degree", "scheduled"], legacy === "scheduled" ? "scheduled" : "all"),
    subjects: values(p, "subjects").filter(v => /^[A-Z0-9 &-]{1,24}$/.test(v)),
    offered: p.get("offered") === "1",
    availability: oneOf(p.get("availability"), ["any", "open", "full", "unknown"], legacy === "open" ? "open" : "any"),
    modes: values(p, "modes").map(v => v.toLowerCase()).filter(v => ["in-person", "hybrid", "online", "unknown"].includes(v)),
    days: values(p, "days").filter(v => ["M", "T", "W", "R", "F", "S", "U"].includes(v)),
    after: time(p.get("after")), before: time(p.get("before")),
    meeting: oneOf(p.get("meeting"), ["any", "scheduled", "unscheduled", "review"], "any"),
    includeUnknown: p.get("includeUnknown") === "1",
    minUnits: units(p.get("minUnits")), maxUnits: units(p.get("maxUnits")),
    instructor: (p.get("instructor") ?? "").trim().slice(0, 120),
    components: values(p, "components").filter(v => /^[A-Z]{1,12}$/.test(v)),
    year: oneOf(p.get("year"), ["any", "early", "late"], legacy === "early" || legacy === "late" ? legacy : "any"),
  };
}
export function writeCourseFilters(params: URLSearchParams, filters: CourseFilters) {
  const next = new URLSearchParams(params);
  next.delete("status");
  for (const key of keys) {
    const value = filters[key];
    next.delete(key);
    if (JSON.stringify(value) !== JSON.stringify(DEFAULT_FILTERS[key])) {
      const text = Array.isArray(value) ? value.join(",") : typeof value === "boolean" ? value ? "1" : "" : value;
      if (text) next.set(key, text);
    }
  }
  return next;
}
export const subjectFor = (code: string) => code.replace(/\s+\d.*$/, "").trim();
export function instructionMode(mode: string) {
  const normalized = mode.trim().toLowerCase().replace(/[-_]/g, " ");
  return normalized.includes("hybrid") ? "hybrid" : normalized.includes("online") ? "online" : /in\s*person/.test(normalized) ? "in-person" : "unknown";
}
export const MODE_LABELS: Record<string, string> = { "in-person": "In person", hybrid: "Hybrid", online: "Fully online", unknown: "Not listed" };
export const COMPONENT_LABELS: Record<string, string> = { LEC: "Lecture", LAB: "Lab", SEM: "Seminar", DIS: "Discussion", ACT: "Activity", CLN: "Clinical", FLD: "Fieldwork", PRA: "Practicum", SUP: "Supervision", UNLISTED: "Not listed" };

export type IndexedSection = { offering: CourseOffering; text: string; mode: string; meeting: ParsedMeeting; incomplete: boolean; noMeetings: boolean };
export function indexSections(offerings: CourseOffering[]) {
  const result = new Map<string, IndexedSection[]>();
  for (const offering of offerings) {
    const meeting = parseMeeting(offering);
    const noMeetings = /^\s*TBA(?:\s*\/\s*TBA)*\s*$/i.test(offering.times) && !meeting.patterns.length;
    const unrecognizedTime = offering.times.split(/\s*\/\s*/).some(part => part.trim() && !/^(?:0?[1-9]|1[0-2]):[0-5]\d(?:AM|PM)\s*-\s*(?:0?[1-9]|1[0-2]):[0-5]\d(?:AM|PM)$/i.test(part.trim()) && !/^[MTWRFSU]+$/i.test(part.trim()));
    const incomplete = meeting.status !== "scheduled" || unrecognizedTime || /TBA|TBD|ARR/i.test(offering.days);
    const row = { offering, meeting, noMeetings, incomplete, mode: instructionMode(offering.mode), text: `${offering.classNumber} ${offering.instructors.join(" ")}`.toLowerCase() };
    const group = result.get(offering.courseCode);
    if (group) group.push(row); else result.set(offering.courseCode, [row]);
  }
  return result;
}
export function hasSectionFilters(f: CourseFilters) {
  return f.offered || f.availability !== "any" || f.modes.length > 0 || f.days.length > 0 || !!f.after || !!f.before || f.meeting !== "any" || !!f.instructor || f.components.length > 0;
}
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function matchesSection(row: IndexedSection, f: CourseFilters) {
  const o = row.offering;
  const knownSeats = o.seatsKnown !== false && Number.isFinite(o.openSeats);
  if (f.availability === "open" && (!knownSeats || o.openSeats <= 0)) return false;
  if (f.availability === "full" && (!knownSeats || o.openSeats > 0)) return false;
  if (f.availability === "unknown" && knownSeats) return false;
  if (f.modes.length && !f.modes.includes(row.mode)) return false;
  if (f.components.length && !f.components.includes(o.component.toUpperCase() || "UNLISTED")) return false;
  if (f.instructor && !o.instructors.some(name => name.toLowerCase().includes(f.instructor.toLowerCase()))) return false;
  if (f.meeting === "scheduled" && (row.incomplete || !row.meeting.patterns.length)) return false;
  if (f.meeting === "unscheduled" && !row.noMeetings) return false;
  if (f.meeting === "review" && !row.incomplete && !o.scheduleReview) return false;
  const constrained = f.days.length || f.after || f.before;
  if (constrained && row.incomplete && !f.includeUnknown) return false;
  return row.meeting.patterns.every(pattern => (!f.days.length || pattern.days.every(day => f.days.includes(day as MeetingDay)))
    && (!f.after || pattern.startMinute >= minutes(f.after)) && (!f.before || pattern.endMinute <= minutes(f.before)));
}
export function unitRange(course: Course): [number, number] | null {
  if (course.unitsText === undefined) return Number.isFinite(course.units) ? [course.units, course.units] : null;
  const match = course.unitsText.trim().match(/^(\d+(?:\.\d+)?)(?:\s*(?:[-–—]|to)\s*(\d+(?:\.\d+)?))?$/i);
  if (!match) return null;
  const min = Number(match[1]), max = Number(match[2] ?? match[1]);
  return min <= max ? [min, max] : null;
}
export type FilterContext = { degreeIds: Set<string>; scheduledCodes: Set<string>; sections: Map<string, IndexedSection[]>; courseText: Map<string, string> };
export function selectFilteredCourses(courses: Course[], query: string, f: CourseFilters, context: FilterContext) {
  const matches: Course[] = [];
  const matchingSections = new Map<string, CourseOffering[]>();
  const q = query.trim().toLowerCase();
  const classNumberQuery = /^\d{5}$/.test(q);
  if (q && q.length < 2) return { courses: matches, matchingSections };
  const sectionFilters = hasSectionFilters(f);
  for (const course of courses) {
    if (f.scope === "degree" && !context.degreeIds.has(course.id) || f.scope === "scheduled" && !context.scheduledCodes.has(course.code)) continue;
    if (f.subjects.length && !f.subjects.includes(subjectFor(course.code))) continue;
    if (f.year === "early" && !(course.recommendedSemester > 0 && course.recommendedSemester <= 4) || f.year === "late" && course.recommendedSemester <= 4) continue;
    if (f.minUnits || f.maxUnits) {
      const range = unitRange(course);
      if (!range || f.minUnits && range[1] < Number(f.minUnits) || f.maxUnits && range[0] > Number(f.maxUnits)) continue;
    }
    const courseMatch = !q || !classNumberQuery && (context.courseText.get(course.id) ?? "").includes(q);
    const sections = (context.sections.get(course.code) ?? []).filter(row => matchesSection(row, f) && (courseMatch || (classNumberQuery ? row.offering.classNumber === q : row.text.includes(q))));
    if ((sectionFilters || !courseMatch) && !sections.length) continue;
    matches.push(course);
    matchingSections.set(course.code, sections.map(row => row.offering));
  }
  return { courses: matches, matchingSections };
}
export function filterGroups(f: CourseFilters): { key: keyof CourseFilters; label: string }[] {
  const groups: { key: keyof CourseFilters; label: string }[] = [];
  const add = (key: keyof CourseFilters, label: string) => groups.push({ key, label });
  if (f.scope !== "all") add("scope", f.scope === "degree" ? "My degree" : "In your week");
  if (f.subjects.length) add("subjects", f.subjects.join(", "));
  if (f.offered) add("offered", "Offered this term");
  if (f.availability !== "any") add("availability", { open: "Open seats", full: "No open seats", unknown: "Seats not listed" }[f.availability]);
  if (f.modes.length) add("modes", f.modes.map(mode => MODE_LABELS[mode]).join(", "));
  if (f.days.length) add("days", `Days: ${f.days.join(" · ")}`);
  if (f.after) add("after", `From ${f.after}`);
  if (f.before) add("before", `Until ${f.before}`);
  if (f.meeting !== "any") add("meeting", { scheduled: "Scheduled meetings", unscheduled: "No scheduled meetings", review: "Needs review" }[f.meeting]);
  if (f.includeUnknown) add("includeUnknown", "Include unknown times");
  if (f.minUnits) add("minUnits", `At least ${f.minUnits} units`);
  if (f.maxUnits) add("maxUnits", `Up to ${f.maxUnits} units`);
  if (f.instructor) add("instructor", `Instructor: ${f.instructor}`);
  if (f.components.length) add("components", f.components.map(c => COMPONENT_LABELS[c] ?? c).join(", "));
  if (f.year !== "any") add("year", f.year === "early" ? "Degree years 1–2" : "Degree years 3–4");
  return groups;
}
