import { apiEndpoint } from "./api";
import { staticPreview } from "./static-preview";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCatalog } from "./CatalogContext";
import { nextRegularTerm, requiredComponents, scheduleScope, termForSlot, termName } from "./scheduleTerms";
import type { CourseOffering } from "./types";
import type { ActionResult } from "./planning";
import type { PlanCoordinator, PlanPreview } from "./PersistentPlanningStore";

type SectionData = { term: string; status: "available" | "unavailable"; offerings: CourseOffering[]; sourceUrl?: string; message: string };
export type SectionChoice = { id: string; courseId: string; code: string; term: string; stage: "loading" | "sections"; offerings: CourseOffering[]; otherOfferings: CourseOffering[]; selected: string[]; message: string };
type Calendar = { status: string; current_term: { season: string; year: number } | null; as_of: string; valid_until: string };
type ScheduleContextValue = {
  selectionsByTerm: Record<string, string[]>; observeCalendar: (term: { season: string; year: number }) => void;
  selectedClassNumbers: string[]; selectedOfferings: CourseOffering[];
  isSelected: (id: string) => boolean; hasSelectedComponent: (offering: CourseOffering) => boolean;
  selectOffering: (offering: CourseOffering) => Promise<ActionResult>; removeOffering: (id: string) => Promise<ActionResult>;
  terms: string[]; activeTerm: string; setActiveTerm: (term: string) => void; termLabel: string;
  offerings: CourseOffering[]; sectionStatus: "loading" | "available" | "unavailable"; sourceUrl?: string;
  calendarVerified: boolean; retryCalendar: () => void; pending: SectionChoice | null; choiceNotice: string;
  chooseSection: (id: string) => void; confirmSections: () => void; cancelSections: () => void; retrySections: (id?: string) => void;
};
const ScheduleContext = createContext<ScheduleContextValue | null>(null);
const failure = (message: string): ActionResult => ({ status: "error", message });
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [activeTerm, selectTerm] = useState(catalog.catalog.currentTerm.id);
  const [data, setData] = useState<Record<string, SectionData>>({});
  const [pending, setPending] = useState<SectionChoice | null>(null);
  const [choiceNotice, setNotice] = useState("");
  const latest = useRef({ catalog, calendar, activeTerm, data, pending });
  latest.current = { catalog, calendar, activeTerm, data, pending };
  const verified = calendar?.status === "verified" && calendar.as_of <= day() && day() <= calendar.valid_until;
  const currentTerm = verified && calendar.current_term ? `${calendar.current_term.season}-${calendar.current_term.year}` : catalog.catalog.currentTerm.id;
  const terms = [...new Set([...(catalog.catalog.availableTerms ?? []), currentTerm, nextRegularTerm(currentTerm)])];
  const calendarRequest = useRef<Promise<Calendar | null> | null>(null);
  const fetched = useRef(new Map<string, number>());
  const requests = useRef(new Map<string, Promise<SectionData>>());
  const waiting = useRef<((ids: string[] | null) => void) | null>(null);
  const busy = useRef(false), generation = useRef(0);
  const refreshCalendar = () => {
    if (staticPreview) return Promise.resolve(null);
    calendarRequest.current = fetch(apiEndpoint("university/terms")).then(async response => { if (!response.ok) throw Error("Calendar unavailable"); return await response.json() as Calendar; }).then(value => { setCalendar(value); latest.current.calendar = value; return value; })
      .catch(() => { setCalendar(null); latest.current.calendar = null; return null; });
    return calendarRequest.current;
  };
  useEffect(() => { void refreshCalendar(); }, []);
  useEffect(() => { if (!terms.includes(activeTerm)) selectTerm(currentTerm); }, [currentTerm]);
  const load = (term: string, refresh = false): Promise<SectionData> => {
    if (staticPreview) {
      const value: SectionData = { term, status: "available", offerings: term === catalog.catalog.currentTerm.id ? catalog.catalog.offerings : [], message: "Recorded section snapshot." };
      setData(current => ({ ...current, [term]: value }));
      return Promise.resolve(value);
    }
    const cached = latest.current.data[term];
    if (!refresh && cached && Date.now() - (fetched.current.get(term) ?? 0) < (cached.status === "available" ? 900000 : 60000)) return Promise.resolve(cached);
    if (requests.current.has(term)) return requests.current.get(term)!;
    const request = fetch(apiEndpoint(`university/sections?term=${encodeURIComponent(term)}`)).then(async response => { if (!response.ok) throw Error("Sections unavailable"); return await response.json() as SectionData; }).catch((): SectionData => ({ term, status: "unavailable", offerings: [], message: "Sections could not be loaded. Try again later." })).then(value => {
      fetched.current.set(term, Date.now()); latest.current.data = { ...latest.current.data, [term]: value };
      setData(latest.current.data); requests.current.delete(term); return value;
    });
    requests.current.set(term, request); return request;
  };
  useEffect(() => { void load(activeTerm); }, [activeTerm]);
  const key = (term: string) => scheduleScope(latest.current.catalog.program, latest.current.catalog.catalog.catalogYear, term);
  const records = (term: string) => [...new Map([
    ...(latest.current.catalog.planningStore.getState().scheduleOfferings?.[key(term)] ?? []),
    ...(term === latest.current.catalog.catalog.currentTerm.id ? latest.current.catalog.catalog.offerings : []),
    ...(latest.current.data[term]?.offerings ?? []),
  ].map(o => [o.classNumber, o])).values()];
  /** Show confirmed sections for one course right away, replacing its earlier sections in that term. */
  const sectionPreview = (term: string, code: string, chosen: CourseOffering[], removed: string[] = []): PlanPreview => store => {
    const state = store.getState(), scope = scheduleScope(state.program, state.catalog.catalogYear, term);
    const records = [...(state.scheduleOfferings?.[scope] ?? []), ...(term === state.catalog.currentTerm.id ? state.catalog.offerings : []), ...(latest.current.data[term]?.offerings ?? [])];
    const drop = new Set([...removed, ...(chosen.length ? records.filter(o => o.courseCode === code).map(o => o.classNumber) : [])]);
    const ids = [...new Set([...(state.schedules[scope] ?? []).filter(n => !drop.has(n)), ...chosen.map(o => o.classNumber)])];
    const snapshots = [...new Map([...records, ...chosen].filter(o => ids.includes(o.classNumber)).map(o => [o.classNumber, o])).values()];
    store.restore({ ...state, schedules: { ...state.schedules, [scope]: ids }, scheduleOfferings: { ...state.scheduleOfferings, [scope]: snapshots } });
  };
  const selectedIn = (term: string) => {
    const ids = latest.current.catalog.planningStore.getState().schedules[key(term)] ?? [];
    if (!ids.length) return [];
    const selected = new Set(ids);
    return records(term).filter(o => selected.has(o.classNumber));
  };
  const savedOfferings = catalog.planningStore.getState().scheduleOfferings;
  const selectedOfferings = useMemo(() => selectedIn(activeTerm), [activeTerm, catalog.program, catalog.catalog.catalogYear, catalog.catalog.currentTerm.id, catalog.catalog.offerings, catalog.schedules, savedOfferings, data]);
  const selectedClassNumbers = catalog.schedules[key(activeTerm)] ?? [];
  // Other queued saves may land while sections are chosen; only a program or profile change cancels the choice.
  const stamp = () => JSON.stringify([latest.current.catalog.program, latest.current.catalog.startingTerm]);
  const cancelSections = () => { generation.current++; waiting.current?.(null); waiting.current = null; setPending(null); setNotice("Canceled. Planner and Schedule are unchanged."); };
  useEffect(() => { if (busy.current) cancelSections(); }, [catalog.program, catalog.startingTerm]);
  useEffect(() => () => { generation.current++; waiting.current?.(null); }, []);

  const coordinate: PlanCoordinator = async (kind, args, save) => {
    if (kind === "agentAction" && ["open_course", "apply_plan_changes", "set_course_sections"].includes(args.action.kind)) return save(kind, args);
    // Plain planner moves queue behind earlier saves; only an open section choice blocks other changes.
    if (!args.chooseAgain) {
      const active = latest.current.catalog;
      const id = kind === "agentAction" ? args.action.course_id : args.id, course = active.courseById.get(id);
      if (!course) return failure("The course is not in the active program.");
      const removing = kind === "removePlan" || kind === "agentAction" && args.action.kind === "remove_course_from_plan";
      if (!removing && active.takenCourseIds.has(id)) return failure("This course is marked completed. Update its completion status before scheduling it.");
      try {
        const result = await save("syncPlan", { baseKind: kind, baseArgs: args, selected: [] });
        setNotice(`${course.code}: ${result.message}`);
        return result;
      } catch { const result = failure("The change could not be saved. Please check your connection and try again."); setNotice(result.message); return result; }
    }
    if (busy.current) return failure("Finish or cancel the current section choice before changing another course.");
    busy.current = true;
    let released = false;
    const initial = stamp(), token = generation.current;
    try {
      const active = latest.current.catalog;
      const id = kind === "agentAction" ? args.action.course_id : args.id, course = active.courseById.get(id);
      if (!course) return failure("The course is not in the active program.");
      const removing = kind === "removePlan" || kind === "agentAction" && args.action.kind === "remove_course_from_plan";
      const slot = kind === "agentAction" ? args.action.semester_slot : args.semester;
      const destination = removing ? undefined : termForSlot(active.termToSlot, slot);
      if (!removing && active.takenCourseIds.has(id)) return failure("This course is marked completed. Update its completion status before scheduling it.");
      let cal = latest.current.calendar;
      const year = Number(destination?.split("-")[1]);
      if (destination && Math.abs(year - new Date().getFullYear()) <= 1 && !cal) cal = await calendarRequest.current;
      if (stamp() !== initial || token !== generation.current) return failure("The plan or profile changed. Please try again.");
      const windowTerms = cal?.status === "verified" && cal.current_term && cal.as_of <= day() && day() <= cal.valid_until
        ? [`${cal.current_term.season}-${cal.current_term.year}`, nextRegularTerm(`${cal.current_term.season}-${cal.current_term.year}`)] : [];
      const term = destination && (windowTerms.includes(destination) || /^(winter|summer)-/.test(destination) && (active.catalog.availableTerms ?? []).includes(destination)) ? destination : undefined;
      let chosen: string[] = [], chosenOfferings: CourseOffering[] = [], unavailable = false;
      if (term) {
        const current = selectedIn(term).filter(o => o.courseCode === course.code);
        setPending({ id: crypto.randomUUID(), courseId: id, code: course.code, term, stage: "loading", offerings: [], otherOfferings: [], selected: [], message: "Loading published sections…" });
        const result = await load(term);
        if (stamp() !== initial || token !== generation.current) return failure("Canceled or changed. No planner change was applied.");
        const offerings = result.offerings.filter(o => o.courseCode === course.code && !o.scheduleReview);
        unavailable = result.status !== "available" || !offerings.length;
        if (!unavailable) {
          const selected = current.filter(o => offerings.some(v => v.classNumber === o.classNumber)).map(o => o.classNumber);
          const complete = requiredComponents(offerings).every(c => offerings.some(o => o.component === c && selected.includes(o.classNumber)));
          if (complete && active.plans[id]?.semester === slot && !args.chooseAgain) chosen = selected;
          else {
            const response = await new Promise<string[] | null>(resolve => {
              waiting.current = resolve;
              setPending({ id: crypto.randomUUID(), courseId: id, code: course.code, term, stage: "sections", offerings,
                otherOfferings: selectedIn(term).filter(o => o.courseCode !== course.code), selected: args.initialSelection ?? selected,
                message: "Choose one section for each listed component. Your plan stays unchanged until you confirm." });
            });
            if (!response) return failure("Canceled. Planner and Schedule are unchanged.");
            chosen = response;
          }
          chosenOfferings = offerings.filter(o => chosen.includes(o.classNumber));
        }
      }
      if (stamp() !== initial || token !== generation.current) return failure("Your plan changed while choosing sections. Please try again.");
      // Confirmed: show the sections now, free the picker for the next course, and let the queue save it.
      released = true; busy.current = false; waiting.current = null; setPending(null);
      if (term) selectTerm(term);
      const result = await save("syncPlan", { baseKind: kind, baseArgs: args, ...(term ? { term } : {}), selected: chosen }, term ? sectionPreview(term, course.code, chosenOfferings) : undefined);
      if (result.status !== "error") {
        setNotice(term ? unavailable ? `${course.code} is in Planner. Sections unavailable; choose later in Schedule.` : `${course.code} saved in Planner and Schedule for ${termName(term)}.` : `${course.code}: ${result.message}`);
      } else setNotice(result.message);
      return unavailable && result.status !== "error" ? { ...result, message: `${result.message} Sections unavailable; choose later in Schedule.` } : result;
    } catch { const result = failure("The change could not be saved. Please check your connection and try again."); setNotice(result.message); return result; }
    finally { if (!released) { busy.current = false; waiting.current = null; setPending(null); } }
  };
  const coordinator = useRef(coordinate); coordinator.current = coordinate;
  useLayoutEffect(() => { catalog.planningStore.coordinatePlan((...args) => coordinator.current(...args)); return () => catalog.planningStore.coordinatePlan(null); }, [catalog.planningStore]);
  const chooseSection = (id: string) => setPending(choice => {
    const offering = choice?.offerings.find(o => o.classNumber === id);
    return choice && offering ? { ...choice, selected: [...choice.selected.filter(n => choice.offerings.find(o => o.classNumber === n)?.component !== offering.component), id] } : choice;
  });
  const confirmSections = () => {
    const choice = latest.current.pending;
    if (!choice || choice.stage !== "sections" || requiredComponents(choice.offerings).some(c => !choice.offerings.some(o => o.component === c && choice.selected.includes(o.classNumber)))) return;
    waiting.current?.(choice.selected); waiting.current = null; setPending(null);
  };
  const selectOffering = async (offering: CourseOffering): Promise<ActionResult> => {
    if (offering.scheduleReview) return failure("Verify this section with SJSU before selecting it.");
    const active = latest.current.catalog, term = latest.current.activeTerm;
    const course = active.allCourses.find(c => c.code === offering.courseCode), slot = /^(winter|summer)-/.test(term) ? term : active.termToSlot[term];
    if (!course || !slot) { const r = failure(!course ? "This course is unavailable in the current catalog." : !active.startingTerm ? "Set your first semester in Account settings before adding sections." : "This term is not mapped to your degree plan. Check your first semester in Account settings."); setNotice(r.message); return r; }
    return active.planningStore.command("setPlan", { id: course.id, semester: slot, status: active.plans[course.id]?.status, chooseAgain: true,
      initialSelection: [...selectedIn(term).filter(o => o.courseCode === course.code && o.component !== offering.component).map(o => o.classNumber), offering.classNumber] });
  };
  const removeOffering = async (id: string): Promise<ActionResult> => {
    const active = latest.current.catalog, term = latest.current.activeTerm;
    const offering = selectedIn(term).find(o => o.classNumber === id), course = active.allCourses.find(c => c.code === offering?.courseCode);
    if (!course || busy.current) return failure("Finish the pending choice before removing a section.");
    const result = await active.planningStore.command("syncPlan", { baseKind: "removeSection", baseArgs: { id: course.id, classNumber: id }, term, selected: [] }, sectionPreview(term, course.code, [], [id]));
    setNotice(result.message); return result;
  };
  const termData = data[activeTerm];
  const prefix = `${catalog.program}:${catalog.catalog.catalogYear}:`;
  const selectionsByTerm = Object.fromEntries(Object.entries(catalog.schedules).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
  return <ScheduleContext.Provider value={{ selectionsByTerm, observeCalendar: () => { void refreshCalendar(); }, selectedClassNumbers, selectedOfferings,
    isSelected: id => selectedClassNumbers.includes(id), hasSelectedComponent: o => selectedOfferings.some(s => s.courseCode === o.courseCode && s.component === o.component), selectOffering, removeOffering,
    terms, activeTerm, setActiveTerm: term => { if (terms.includes(term)) selectTerm(term); }, termLabel: termName(activeTerm), offerings: termData?.offerings ?? [], sectionStatus: termData?.status ?? "loading", sourceUrl: termData?.sourceUrl,
    calendarVerified: !!verified, retryCalendar: () => { void refreshCalendar(); }, pending, choiceNotice, chooseSection, confirmSections, cancelSections,
    retrySections: id => { if (id && catalog.plans[id]) void catalog.planningStore.command("setPlan", { id, ...catalog.plans[id], chooseAgain: true }); else void load(activeTerm, true); },
  }}>{children}</ScheduleContext.Provider>;
}
export function useSchedule() { const context = useContext(ScheduleContext); if (!context) throw new Error("useSchedule must be used inside ScheduleProvider"); return context; }
