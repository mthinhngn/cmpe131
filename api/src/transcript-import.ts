import type { PlanSlot, PlanningStore, State } from "./planning-engine";

export type TranscriptPlacement = { course_id: string; term: string; status: "completed" | "in_progress" };

export function transcriptTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const seasons = value.toLowerCase().match(/\b(winter|spring|summer|fall)\b/g);
  const years = value.match(/\b(?:19|20|21)\d{2}\b/g);
  return seasons?.length === 1 && years?.length === 1 ? `${seasons[0]}-${years[0]}` : null;
}

export function transcriptSlot(term: string, start: string): PlanSlot {
  if (!/^(winter|spring|summer|fall)-(19|20|21)\d{2}$/.test(term) || !/^(winter|spring|summer|fall)-(19|20|21)\d{2}$/.test(start)) throw Error("Choose your first semester before importing.");
  const seasons = ["winter", "spring", "summer", "fall"];
  const [season, year] = term.split("-"), [firstSeason, firstYear] = start.split("-");
  if (+year * 4 + seasons.indexOf(season) < +firstYear * 4 + seasons.indexOf(firstSeason)) throw Error("Term is before your first semester. Check your account details.");
  if (season === "winter" || season === "summer") return term;
  const slot = (+year - +firstYear) * 2 + Number(season === "fall") - Number(firstSeason === "fall" || firstSeason === "summer") + 1;
  if (slot < 1 || slot > 100) throw Error("Term is outside the supported 100 semesters.");
  return slot;
}

export function transcriptPlacementIssue(state: State, row: TranscriptPlacement, start: string): string | null {
  if (!row || !state.catalog.courses.some(c => c.id === row.course_id)) return "No course match in this workspace.";
  if (!["completed", "in_progress"].includes(row.status)) return "Only completed or in-progress courses can be imported.";
  try {
    const slot = transcriptSlot(row.term, start);
    const saved = state.plans[state.program]?.[row.course_id];
    if (saved && saved.semester !== slot) return "Already placed in another term. Move it in Planner before importing.";
    if (row.status === "in_progress" && state.completed.includes(row.course_id)) return "Already marked completed. Review this course in Planner.";
    return null;
  } catch (error) { return (error as Error).message; }
}

/** Validate the entire import before changing any state; workspace operations persist it atomically. */
export function importTranscript(store: PlanningStore, rows: TranscriptPlacement[], start: string) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw Error("Select 1–500 transcript courses.");
  const before = store.getState(), seen = new Set<string>();
  for (const row of rows) {
    const issue = transcriptPlacementIssue(before, row, start);
    if (issue) throw Error(issue);
    if (seen.has(row.course_id)) throw Error("A repeated course needs review. Select only one attempt per course.");
    seen.add(row.course_id);
  }
  const plans = { ...store.plans }, completed = new Set(before.completed);
  const numbers = new Set(store.semesterSlots), named = new Set(before.namedTerms?.[before.program] ?? []);
  for (const row of rows) {
    const semester = transcriptSlot(row.term, start);
    if (typeof semester === "number") {
      for (let n = store.semesterCount + 1; n <= semester; n++) numbers.add(n);
      numbers.add(semester);
    } else named.add(semester);
    plans[row.course_id] = { semester, status: row.status === "in_progress" ? "in-progress" : "planned" };
    if (row.status === "completed") completed.add(row.course_id);
  }
  const date = (slot: PlanSlot) => {
    if (typeof slot === "string") {
      const [season, year] = slot.split("-");
      return +year * 4 + ["winter", "spring", "summer", "fall"].indexOf(season);
    }
    const [season, year] = start.split("-");
    const n = +year * 2 + Number(season === "fall" || season === "summer") + slot - 1;
    return Math.floor(n / 2) * 4 + (n % 2 ? 3 : 1);
  };
  // Keep the relative order of saved terms; insert only newly required terms by date.
  const order = store.termOrder;
  for (const slot of [...numbers, ...named].filter(slot => !order.includes(slot)).sort((a, b) => date(a) - date(b))) {
    const next = order.findIndex(existing => date(existing) > date(slot));
    order.splice(next < 0 ? order.length : next, 0, slot);
  }
  store.restore({ ...before, plans: { ...before.plans, [before.program]: plans }, completed: [...completed],
    startingTerms: { ...before.startingTerms, [before.program]: start },
    semesterSlots: { ...before.semesterSlots, [before.program]: [...numbers].sort((a, b) => a - b) },
    namedTerms: { ...before.namedTerms, [before.program]: [...named] },
    counts: { ...before.counts, [before.program]: Math.max(0, ...numbers) },
    termOrder: { ...before.termOrder, [before.program]: order }, revision: before.revision + 1 });
}
