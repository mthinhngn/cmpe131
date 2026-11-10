import { BadRequestException } from "@nestjs/common";
import type { CourseOffering } from "./course-types";
import type { PlanningStore, PlanSlot } from "./planning-engine";

export type SectionData = { term: string; status: string; offerings: CourseOffering[]; message?: string };
export type CalendarData = { status: string; as_of: string; valid_until: string; current_term: { season: string; year: number }; next_term: { season: string; year: number } };
export const termFor = (start: string | null | undefined, slot: PlanSlot | undefined): string | undefined => {
  if (typeof slot === "string") return slot;
  if (!start || !/^(winter|spring|summer|fall)-\d{4}$/.test(start) || !slot) return;
  const [season, year] = start.split("-");
  const n = Number(year) * 2 + Number(season === "fall" || season === "summer") + slot - 1;
  return `${n % 2 ? "fall" : "spring"}-${Math.floor(n / 2)}`;
};
export async function sourceData(path: string) {
  const base = (process.env.AGENT_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${base}/agent/${path}`, { signal: AbortSignal.timeout(65000) });
  if (!response.ok) throw new Error("Official sections could not be verified. Try again later.");
  return response.json();
}
const fail = (message: string): never => { throw new BadRequestException(message); };

/** Apply the planner and its selected section snapshots in the same workspace transaction. */
export function syncPlan(store: PlanningStore, args: Record<string, any>, calendar: CalendarData | null, sections: SectionData | null,
  profileStart: string | undefined, apply: (kind: string, payload: Record<string, any>) => void) {
  const before = store.getState();
  const start = profileStart ?? before.startingTerms?.[before.program];
  const kind = args.baseKind, payload = args.baseArgs;
  if (!payload || !["setPlan", "removePlan", "agentAction", "removeSection"].includes(kind)) fail("Invalid synchronized change.");
  const id = kind === "agentAction" ? payload.action?.course_id : payload.id;
  const course = before.catalog.courses.find(c => c.id === id);
  if (!course) fail("Unknown course in current program.");
  const code = course!.code;
  const old = store.plans[id];
  const term = args.term as string | undefined;
  const scope = (t: string) => `${before.program}:${before.catalog.catalogYear}:${t}`;
  const selected: string[] = args.selected ?? [];
  if (!Array.isArray(selected) || selected.length > 20 || selected.some(n => typeof n !== "string") || new Set(selected).size !== selected.length) fail("Invalid section selection.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const monitored = calendar?.status === "verified" && calendar.as_of <= today && today <= calendar.valid_until
    ? [calendar.current_term, calendar.next_term].map(t => `${t.season}-${t.year}`) : [];
  let chosen: CourseOffering[] = [];
  if (kind === "removeSection") {
    if (!term || typeof payload.classNumber !== "string") fail("Invalid section removal.");
    const key = scope(term!);
    const records = [...(before.scheduleOfferings?.[key] ?? []), ...(term === before.catalog.currentTerm.id ? before.catalog.offerings : [])];
    if (!records.some(o => o.courseCode === code && o.classNumber === payload.classNumber) || !before.schedules[key]?.includes(payload.classNumber)) fail("This section is no longer selected.");
    const rest = before.schedules[key].filter(n => n !== payload.classNumber);
    const other = records.some(o => o.courseCode === code && rest.includes(o.classNumber));
    if (!other && termFor(start, old?.semester) === term) store.removePlan(id);
    const current = store.getState();
    store.restore({ ...current, schedules: { ...current.schedules, [key]: rest }, scheduleOfferings: { ...current.scheduleOfferings, [key]: records.filter(o => rest.includes(o.classNumber)) }, revision: current.revision + 1 });
    return;
  }
  if (term) {
    const destination = kind === "agentAction" ? payload.action?.semester_slot : payload.semester;
    if ((!monitored.includes(term) && !(/^(winter|summer)-/.test(term) && before.catalog.availableTerms?.includes(term) && sections?.status === "available")) || termFor(start, destination) !== term) fail("The destination no longer matches the verified current/next semester and your profile. Refresh before trying again.");
    const available = sections?.status === "available" && sections.term === term ? sections.offerings.filter(o => o.courseCode === code && !o.scheduleReview) : [];
    chosen = selected.map(n => available.find(o => o.classNumber === n) ?? fail("A selected section is no longer published for this course and semester."));
    if (available.length) {
      const components = [...new Set(available.map(o => o.component))];
      if (components.some(c => chosen.filter(o => o.component === c).length !== 1)) fail("Choose one section for every required component before confirming.");
    } else if (selected.length) fail("Sections are unavailable for this semester.");
  } else if (selected.length) fail("A verified semester is required for selected sections.");
  apply(kind, payload);
  const after = store.getState();
  const schedules = { ...after.schedules }, snapshots = { ...after.scheduleOfferings };
  const changed = old?.semester !== store.plans[id]?.semester || !store.plans[id];
  for (const key of Object.keys(schedules).filter(k => k.startsWith(`${before.program}:${before.catalog.catalogYear}:`))) {
    if (!changed && (!term || key !== scope(term))) continue;
    const records = [...(snapshots[key] ?? []), ...(key === scope(before.catalog.currentTerm.id) ? before.catalog.offerings : [])];
    const removed = new Set(records.filter(o => o.courseCode === code).map(o => o.classNumber));
    schedules[key] = schedules[key].filter(n => !removed.has(n));
    snapshots[key] = records.filter(o => schedules[key].includes(o.classNumber));
  }
  if (term) {
    const key = scope(term);
    schedules[key] = [...new Set([...(schedules[key] ?? []), ...chosen.map(o => o.classNumber)])];
    snapshots[key] = [...new Map([...(snapshots[key] ?? []), ...chosen].map(o => [o.classNumber, o])).values()];
  }
  store.restore({ ...after, schedules, scheduleOfferings: snapshots, revision: after.revision + 1 });
}
