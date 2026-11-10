import type { Course, ProgramCatalog, CourseOffering } from "./course-types";
import { requirementMatches } from "./requirement-choices";

export type PlanSlot = number | string;
export const isNamedSlot = (value: unknown): value is string => typeof value === "string" && /^(winter|summer)-(19|20|21)\d{2}$/.test(value);
export const validSlot = (value: unknown, count: number) => isNamedSlot(value) || typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= count;
export type Plan = { semester: PlanSlot; status: "planned" | "in-progress" };
export type Plans = Record<string, Plan>;
export type PlanningAction = { operation: "add" | "move" | "remove"; course: string; target: string | null };
export type Proposal = { requestId: string; revision: number; program: string; actions: unknown; selectedCourseId: string | null };
export type PendingAction = { operation: "add" | "move"; course: string; revision: number; program: string; selectedCourseId: string | null };
export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; status?: string; edits?: Edit[]; revision?: number; proposal?: Proposal; pending?: PendingAction };
export type State = {
  program: string; catalog: ProgramCatalog; completed: string[]; revision: number;
  additionalPrograms?: Record<string, string[]>;
  requirementChoices?: Record<string, Record<string, string>>;
  plans: Record<string, Plans>; counts: Record<string, number>; terms: Record<string, Record<number, string>>;
  messages: Record<string, ChatMessage[]>; schedules: Record<string, string[]>;
  scheduleOfferings?: Record<string, CourseOffering[]>;
  startingTerms?: Record<string, string | null>; namedTerms?: Record<string, string[]>; semesterSlots?: Record<string, number[]>; termOrder?: Record<string, PlanSlot[]>;
  views: Record<string, { semester: PlanSlot; selectedCourseId: string | null }>;
  undoRevision?: number;
  undoRequestId?: string;
};
export type Edit = { courseId: string; before?: Plan; after?: Plan };
export type ActionResult = { status: "success" | "review" | "error" | "unchanged"; message: string; edits?: Edit[]; revision?: number };

export function parseActions(input: unknown): PlanningAction[] {
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new Error("Expected 1–50 planning actions.");
  return input.map(value => {
    if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== "course,operation,target" || !["add", "move", "remove"].includes(value.operation) || typeof value.course !== "string" || !value.course.trim() || value.course.length > 200 || (value.target !== null && (typeof value.target !== "string" || value.target.length > 100))) throw new Error("Invalid planning tool arguments.");
    if (value.operation === "remove" ? value.target !== null : !value.target?.trim()) throw new Error("Specify a target semester for add or move; remove must have a null target.");
    return value as PlanningAction;
  });
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
export function findCourses(courses: Course[], query: string) {
  const key = normalize(query);
  const exact = courses.filter(c => [c.id, c.code, c.title].some(value => normalize(value) === key));
  return exact.length ? exact : key ? courses.filter(c => normalize(`${c.code} ${c.title}`).includes(key)) : [];
}

// One store backs both CatalogContext controls and assistant transactions; nothing is persisted here.
export class PlanningStore {
  private state: State;
  private listeners = new Set<() => void>();
  private executed = new Map<string, string>();
  constructor(program: string, catalog: ProgramCatalog, completed: string[] = []) {
    this.state = { program, catalog, completed, revision: 0, plans: {}, counts: {}, terms: {}, messages: {}, schedules: {}, views: {} };
  }
  restore(state: State) { this.state = state; this.listeners.forEach(listener => listener()); }
  getState = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    this.listeners.forEach(listener => listener());
  }
  get plans(): Plans { return this.state.plans[this.state.program] ?? {}; }
  get terms() { return this.state.terms[this.state.program] ?? {}; }
  get semesterSlots(): number[] {
    return this.state.semesterSlots?.[this.state.program] ?? Array.from({ length: Math.max(this.state.catalog.requirementGroups.length, this.state.counts[this.state.program] ?? 0, ...Object.values(this.plans).flatMap(p => typeof p.semester === "number" ? [p.semester] : [])) }, (_, i) => i + 1);
  }
  get termOrder(): PlanSlot[] {
    const active: PlanSlot[] = [...this.semesterSlots, ...(this.state.namedTerms?.[this.state.program] ?? [])];
    return [...new Set([...(this.state.termOrder?.[this.state.program] ?? []).filter(slot => active.includes(slot)), ...active])];
  }
  get semesterCount() { return Math.max(0, ...this.semesterSlots); }
  get nextSemester() { return Math.max(this.state.catalog.requirementGroups.length, this.state.counts[this.state.program] ?? 0, this.semesterCount) + 1; }
  validSlot(slot: unknown) { return isNamedSlot(slot) || typeof slot === "number" && this.semesterSlots.includes(slot); }
  selectProgram(program: string, catalog: ProgramCatalog, additionalPrograms?: string[]) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(program) || !catalog) throw new Error("Invalid program.");
    this.update({ program, catalog, ...(additionalPrograms ? { additionalPrograms: { ...this.state.additionalPrograms, [program]: additionalPrograms } } : {}) });
  }
  setCatalog(catalog: ProgramCatalog) { this.update({ catalog }); }
  invalidate() { this.update({}); }
  toggleTakenCourse(id: string) {
    if (!this.state.catalog.courses.some(c => c.id === id)) throw new Error("Unknown course.");
    const completed = new Set(this.state.completed);
    if (completed.has(id)) completed.delete(id); else completed.add(id);
    this.update({ completed: [...completed] });
  }
  chooseRequirement(requirementId: string, courseId: string) {
    const { catalog, program } = this.state;
    const groupIndex = catalog.requirementGroups.findIndex(group => group.items.some(item => item.id === requirementId && item.type === "placeholder"));
    const item = catalog.requirementGroups[groupIndex]?.items.find(item => item.id === requirementId);
    const course = catalog.courses.find(course => course.id === courseId);
    const choices = this.state.requirementChoices?.[program] ?? {};
    if (!item || !course || !requirementMatches(course, item, catalog)) throw Error("Choose a course matching this requirement's recorded category.");
    if (Object.entries(choices).some(([id, chosen]) => id !== requirementId && chosen === courseId)) throw Error("This course is already selected for another requirement.");
    const semester = item.recommendedSemester ?? groupIndex + 1;
    if (!this.plans[courseId] && !this.validSlot(semester)) throw Error("Restore this term in Planner before choosing a course.");
    const plans = { ...this.plans };
    const previous = choices[requirementId];
    const removePrevious = previous && previous !== courseId && plans[previous]?.semester === semester;
    if (removePrevious) delete plans[previous];
    plans[courseId] ??= { semester, status: "planned" };
    const previousCode = removePrevious ? catalog.courses.find(c => c.id === previous)?.code : undefined;
    const offerings = [...catalog.offerings, ...Object.values(this.state.scheduleOfferings ?? {}).flat()];
    const schedules = Object.fromEntries(Object.entries(this.state.schedules).map(([scope, selected]) => [scope,
      previousCode && scope.startsWith(`${program}:`) ? selected.filter(id => !offerings.some(o => o.classNumber === id && o.courseCode === previousCode)) : selected]));
    this.update({ plans: { ...this.state.plans, [program]: plans }, schedules,
      requirementChoices: { ...this.state.requirementChoices, [program]: { ...choices, [requirementId]: courseId } } });
  }
  setPlan(id: string, semester: PlanSlot, status: Plan["status"] = "planned") {
    if (!this.state.catalog.courses.some(c => c.id === id) || !this.validSlot(semester) || !["planned", "in-progress"].includes(status)) throw new Error("Invalid course or semester.");
    this.update({ namedTerms: isNamedSlot(semester) ? { ...this.state.namedTerms, [this.state.program]: [...new Set([...(this.state.namedTerms?.[this.state.program] ?? []), semester])] } : this.state.namedTerms, plans: { ...this.state.plans, [this.state.program]: { ...this.plans, [id]: { semester, status } } }, completed: this.state.completed.filter(courseId => courseId !== id) });
  }
  removePlan(id: string) {
    const plans = { ...this.plans }; delete plans[id];
    this.update({ plans: { ...this.state.plans, [this.state.program]: plans } });
  }
  moveCompletedCourse(id: string, semester: PlanSlot) {
    if (!this.state.completed.includes(id) || !this.state.catalog.courses.some(c => c.id === id) || !this.validSlot(semester)) throw new Error("Invalid completed course or semester.");
    this.update({ plans: { ...this.state.plans, [this.state.program]: { ...this.plans, [id]: { semester, status: "planned" } } },
      namedTerms: isNamedSlot(semester) ? { ...this.state.namedTerms, [this.state.program]: [...new Set([...(this.state.namedTerms?.[this.state.program] ?? []), semester])] } : this.state.namedTerms });
  }
  moveSemester(from: PlanSlot, to: PlanSlot, startingTerm?: string | null) {
    const order = this.termOrder;
    if (!order.includes(from) || !order.includes(to)) throw new Error("Choose existing terms to move.");
    if (from === to) return from;
    const destination = order.indexOf(to);
    order.splice(destination, 0, ...order.splice(order.indexOf(from), 1));
    const start = startingTerm ?? this.state.startingTerms?.[this.state.program] ?? this.state.catalog.currentTerm.id;
    const [startSeason, startYear] = start.split("-");
    const first = Number(startYear) * 2 + Number(startSeason === "fall" || startSeason === "summer");
    let year = Number(startYear), lastSeason = -1, regular = 0;
    const mapping = new Map<PlanSlot, PlanSlot>();
    const seasons = ["winter", "spring", "summer", "fall"];
    for (const slot of order) {
      const season = typeof slot === "string" ? slot.split("-")[0] : (first + regular++) % 2 ? "fall" : "spring";
      const index = seasons.indexOf(season);
      if (index <= lastSeason) year++;
      lastSeason = index;
      const next = typeof slot === "string" ? `${season}-${year}` : year * 2 + Number(season === "fall") - first + 1;
      if (typeof next === "number" ? !validSlot(next, 100) : !isNamedSlot(next)) throw new Error("The reordered terms exceed the supported calendar range.");
      mapping.set(slot, next);
    }
    const plans = { ...this.plans };
    for (const course of this.state.catalog.courses) {
      if (this.state.completed.includes(course.id) && !plans[course.id] && mapping.has(course.recommendedSemester)) plans[course.id] = { semester: course.recommendedSemester, status: "planned" };
    }
    for (const [id, plan] of Object.entries(plans)) if (mapping.has(plan.semester)) plans[id] = { ...plan, semester: mapping.get(plan.semester)! };
    const dates = new Set<string>();
    for (const [old, next] of mapping) if (old !== next) {
      const n = typeof old === "number" ? first + old - 1 : 0;
      dates.add(typeof old === "string" ? old : `${n % 2 ? "fall" : "spring"}-${Math.floor(n / 2)}`);
    }
    const schedules = { ...this.state.schedules }, snapshots = { ...this.state.scheduleOfferings };
    const prefix = `${this.state.program}:${this.state.catalog.catalogYear}:`;
    for (const key of Object.keys(schedules)) if (key.startsWith(prefix) && dates.has(key.slice(prefix.length))) { delete schedules[key]; delete snapshots[key]; }
    const nextOrder = [...mapping.values()];
    const numbers = nextOrder.filter((slot): slot is number => typeof slot === "number");
    this.update({ plans: { ...this.state.plans, [this.state.program]: plans }, schedules, scheduleOfferings: snapshots,
      terms: { ...this.state.terms, [this.state.program]: Object.fromEntries(numbers.map(slot => {
        const n = first + slot - 1;
        return [slot, `${n % 2 ? "Fall" : "Spring"} ${Math.floor(n / 2)}`];
      })) },
      termOrder: { ...this.state.termOrder, [this.state.program]: nextOrder },
      semesterSlots: { ...this.state.semesterSlots, [this.state.program]: numbers },
      namedTerms: { ...this.state.namedTerms, [this.state.program]: nextOrder.filter((slot): slot is string => typeof slot === "string") },
      counts: { ...this.state.counts, [this.state.program]: Math.max(this.state.counts[this.state.program] ?? 0, ...numbers) } });
    return mapping.get(from)!;
  }
  addSemester() {
    const slot = this.nextSemester;
    if (slot > 100) throw new Error("Maximum 100 semesters.");
    this.update({ counts: { ...this.state.counts, [this.state.program]: slot }, semesterSlots: { ...this.state.semesterSlots, [this.state.program]: [...this.semesterSlots, slot] } });
  }
  addNamedTerm(term: string) {
    if (!isNamedSlot(term)) throw new Error("Choose a valid Winter or Summer term.");
    this.update({ namedTerms: { ...this.state.namedTerms, [this.state.program]: [...new Set([...(this.state.namedTerms?.[this.state.program] ?? []), term])] } });
  }
  removeSemester(slot: PlanSlot, calendarTerm?: string) {
    const before = this.state, program = before.program;
    const numbers = this.semesterSlots, named = before.namedTerms?.[program] ?? [];
    if (typeof slot === "number" ? !numbers.includes(slot) : !named.includes(slot)) throw new Error("This term is not in your plan.");
    const removed = Object.keys(this.plans).filter(id => this.plans[id].semester === slot);
    const codes = new Set(before.catalog.courses.filter(c => removed.includes(c.id)).map(c => c.code));
    const plans = Object.fromEntries(Object.entries(this.plans).filter(([, p]) => p.semester !== slot));
    const schedules = { ...before.schedules }, snapshots = { ...before.scheduleOfferings };
    const prefix = `${program}:${before.catalog.catalogYear}:`;
    for (const key of Object.keys(schedules).filter(key => key.startsWith(prefix))) {
      if (key === `${prefix}${calendarTerm ?? slot}`) { delete schedules[key]; delete snapshots[key]; continue; }
      const records = [...(snapshots[key] ?? []), ...(key === `${prefix}${before.catalog.currentTerm.id}` ? before.catalog.offerings : [])];
      const deleted = new Set(records.filter(o => codes.has(o.courseCode)).map(o => o.classNumber));
      schedules[key] = schedules[key].filter(id => !deleted.has(id));
      snapshots[key] = records.filter(o => schedules[key].includes(o.classNumber));
    }
    const terms = { ...this.terms }; if (typeof slot === "number") delete terms[slot];
    this.update({ plans: { ...before.plans, [program]: plans }, semesterSlots: { ...before.semesterSlots, [program]: numbers.filter(n => n !== slot) },
      counts: { ...before.counts, [program]: Math.max(before.counts[program] ?? 0, this.semesterCount) },
      namedTerms: { ...before.namedTerms, [program]: named.filter(t => t !== slot) }, terms: { ...before.terms, [program]: terms }, schedules, scheduleOfferings: snapshots });
  }
  removeLastSemester() {
    const count = this.semesterCount;
    if (count <= this.state.catalog.requirementGroups.length || Object.values(this.plans).some(p => p.semester === count)) return;
    this.removeSemester(count);
    this.update({ counts: { ...this.state.counts, [this.state.program]: count - 1 } });
  }
  setTerm(semester: number, term: string) {
    if (!Number.isInteger(semester) || !this.semesterSlots.includes(semester) || (term && !/^(Spring|Summer|Fall|Winter) 20\d{2}$/.test(term))) throw new Error("Choose a valid semester and term (for example Fall 2026).");
    if (term && Object.entries(this.terms).some(([n, value]) => Number(n) !== semester && value === term)) throw new Error(`${term} is already mapped to another semester.`);
    this.update({ terms: { ...this.state.terms, [this.state.program]: { ...this.terms, [semester]: term } } });
  }
  snapshot() {
    return { revision: this.state.revision, program: this.state.program, plans: this.plans, terms: this.terms, semesterCount: this.semesterCount, completedCourseIds: this.state.completed, courses: this.state.catalog.courses.map(({ id, code, title }) => ({ id, code, title })) };
  }
  private resolve(actions: PlanningAction[], selectedCourseId: string | null) {
    const seen = new Set<string>();
    return actions.map(action => {
      const matches = /^(this|selected) course$/i.test(action.course.trim())
        ? this.state.catalog.courses.filter(c => c.id === selectedCourseId) : findCourses(this.state.catalog.courses, action.course);
      if (matches.length !== 1) throw new Error(matches.length ? `Which course: ${matches.slice(0, 6).map(c => c.code).join(", ")}?` : `Which course do you mean by “${action.course}”? It is not resolved in the current program. Select a listed course or check the program and full course code.`);
      const course = matches[0];
      if (seen.has(course.id)) throw new Error("Use one action per course in a proposal.");
      seen.add(course.id);
      if (this.state.completed.includes(course.id)) throw new Error(`${course.code} is completed. Planning actions cannot change completion status.`);
      const before = this.plans[course.id];
      if (action.operation === "remove") return { courseId: course.id, before };
      const numbered = /^semester\s+(\d+)$/i.exec(action.target!.trim());
      const calendarTerm = /^(spring|summer|fall|winter)\s+20\d{2}$/i.test(action.target!.trim());
      const semester = numbered ? Number(numbered[1]) : calendarTerm ? Number(Object.entries(this.terms).find(([, term]) => term && normalize(term) === normalize(action.target!))?.[0]) : NaN;
      if (!Number.isInteger(semester) || !this.semesterSlots.includes(semester)) throw new Error(`Which semester is “${action.target}”? Set its term mapping, or specify Semester 1–${this.semesterCount}.`);
      if (action.operation === "move" && !before) throw new Error(`${course.code} is not planned yet. Ask to add it first.`);
      return { courseId: course.id, before, after: { semester, status: before?.status ?? "planned" } } satisfies Edit;
    });
  }
  apply(proposal: Proposal, reviewed = false): ActionResult {
    try {
      const fingerprint = JSON.stringify(proposal);
      if (!proposal.requestId || proposal.requestId.length > 100) throw new Error("Invalid request ID.");
      if (this.executed.has(proposal.requestId)) {
        if (this.executed.get(proposal.requestId) !== fingerprint) throw new Error("Request ID was reused with different arguments.");
        return { status: "unchanged", message: "This request was already applied. Nothing changed." };
      }
      if (proposal.program !== this.state.program || proposal.revision !== this.state.revision) throw new Error("Your plan, program, or catalog changed. Send the request again using the current plan.");
      const actions = parseActions(proposal.actions);
      const edits = this.resolve(actions, proposal.selectedCourseId);
      // PostgreSQL JSONB may reorder object keys. Compare plan values, not serialization.
      const changed = edits.filter(edit => edit.before?.semester !== edit.after?.semester || edit.before?.status !== edit.after?.status);
      if (!changed.length) return { status: "unchanged", message: "Your plan already matches this request. Nothing changed." };
      const conflicts = edits.filter((edit, i) => actions[i].operation === "add" && edit.before && edit.after?.semester !== edit.before.semester);
      if (!reviewed && (actions.length > 1 || conflicts.length)) return { status: "review", edits: changed, message: conflicts.length ? "Already planned in another semester. Review and confirm the move before changing your plan." : "Review all proposed course changes before applying." };
      // Validate the entire batch first, then use the same actions as the manual controls.
      changed.forEach(edit => { if (edit.after) this.setPlan(edit.courseId, edit.after.semester, edit.after.status); else this.removePlan(edit.courseId); });
      this.executed.set(proposal.requestId, fingerprint);
      return { status: "success", message: "Plan updated.", edits: changed, revision: this.state.revision };
    } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Unable to update plan." }; }
  }
  undo(edits: Edit[], revision: number): ActionResult {
    if (revision !== this.state.revision) return { status: "error", message: "Your plan changed after this edit. Undo is no longer safe; request a new edit." };
    edits.forEach(edit => { if (edit.before) this.setPlan(edit.courseId, edit.before.semester, edit.before.status); else this.removePlan(edit.courseId); });
    return { status: "success", message: "Change undone.", edits: edits.map(edit => ({ courseId: edit.courseId, before: edit.after, after: edit.before })), revision: this.state.revision };
  }
}

export function planningWarnings(course: Course, semester: number, catalog: ProgramCatalog, plans: Plans, completed: Set<string>, terms: Record<number, string>) {
  const warnings: string[] = [];
  const unmet = course.prerequisiteCourseIds.filter(id => !completed.has(id) && !(typeof plans[id]?.semester === "number" && (plans[id].semester as number) < semester));
  if (unmet.length) warnings.push(`Review prerequisites: ${unmet.map(id => catalog.courses.find(c => c.id === id)?.code ?? id).join(", ")}.`);
  const coreqs = course.corequisiteCourseIds.filter(id => !completed.has(id) && !(typeof plans[id]?.semester === "number" && (plans[id].semester as number) <= semester));
  if (coreqs.length) warnings.push(`Review corequisites: ${coreqs.map(id => catalog.courses.find(c => c.id === id)?.code ?? id).join(", ")}.`);
  if (course.prerequisiteText) warnings.push(course.prerequisiteText);
  if (terms[semester] !== catalog.currentTerm.name) warnings.push("Availability is unverified for this term.");
  else if (!catalog.offerings.some(o => o.courseCode === course.code)) warnings.push("No listed sections in the term snapshot.");
  else warnings.push("Listed sections are a dated snapshot; seats are not live.");
  return warnings;
}
