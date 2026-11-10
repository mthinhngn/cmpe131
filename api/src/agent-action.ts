/** One atomic, authenticated workspace operation for the browser agent transport. */
import { PlanningStore, validSlot, isNamedSlot } from "./planning-engine";
import { termFor } from "./schedule-sync";

export function applyAgentAction(store: PlanningStore, input: Record<string, any>) {
  const action = input.action, state = store.getState();
  const fail = (message: string): never => { throw new Error(message); };
  if (action?.kind === "apply_plan_changes") {
    if (!["swap", "replace"].includes(action.operation) || !Array.isArray(action.changes) || action.changes.length !== 2 || new Set(action.changes.map((c: any) => c.course_id)).size !== 2) fail("Invalid grouped course change.");
    const [a, b] = action.changes;
    if (action.operation === "swap" ? a.kind !== "move_course_in_plan" || b.kind !== "move_course_in_plan" || a.semester_slot !== b.previous_semester_slot || b.semester_slot !== a.previous_semester_slot
      : a.kind !== "remove_course_from_plan" || b.kind !== "add_course_to_plan" || a.previous_semester_slot !== b.semester_slot) fail("Invalid swap or replacement destinations.");
    const prefix = `${state.program}:${state.catalog.catalogYear}:`;
    const start = input.profileStart ?? state.startingTerms?.[state.program];
    for (const change of action.changes) {
      if (!["move_course_in_plan", "remove_course_from_plan"].includes(change.kind)) continue;
      const sourceTerm = termFor(start, change.previous_semester_slot);
      for (const [key, ids] of Object.entries(state.schedules)) {
        if (!key.startsWith(prefix) || !ids.length) continue;
        const term = key.slice(prefix.length);
        if (sourceTerm && term !== sourceTerm) continue;
        const records = [...(state.scheduleOfferings?.[key] ?? []), ...(term === state.catalog.currentTerm?.id ? state.catalog.offerings : [])];
        for (const id of ids) {
          const offering = records.find(o => o.classNumber === id);
          if (!offering) fail(`A saved section in ${term} could not be identified. Refresh Schedule before changing courses in this semester. No courses were changed.`);
          if (offering!.courseCode === change.course_code) fail(`${change.course_code} has a selected weekly section in ${term}. Update that course's section selection before moving or replacing it. No courses were changed.`);
        }
      }
    }
    const next = new PlanningStore(state.program, state.catalog);
    next.restore(structuredClone(state));
    for (const change of action.changes) {
      if (change.kind !== "remove_course_from_plan" && (typeof change.semester_slot !== "number" || !store.validSlot(change.semester_slot))) fail("Grouped changes require numbered semesters.");
      // Validate against the original revision; mutations remain private until both pass.
      const current = next.getState();
      next.restore({ ...current, revision: state.revision });
      applyAgentAction(next, { ...input, action: { ...change, expected_revision: action.expected_revision, program_id: action.program_id } });
    }
    store.restore({ ...next.getState(), views: state.views, revision: state.revision + 1 });
    return;
  }
  if (!action || !["open_course", "add_course_to_plan", "move_course_in_plan", "remove_course_from_plan"].includes(action.kind) || typeof action.action_id !== "string" || typeof action.tool_call_id !== "string") fail("Invalid agent action.");
  let expected: { workspace_revision?: number };
  try { expected = JSON.parse(action.expected_revision); } catch { return fail("Invalid action context."); }
  if (!input.browserFresh || expected.workspace_revision !== state.revision || action.program_id !== state.program) fail("The page or saved plan changed. No action was applied.");
  const course = state.catalog.courses.find(c => c.id === action.course_id);
  if (!course || course.code !== action.course_code) fail("The course does not match the active catalog.");
  const previous = store.plans[action.course_id];
  if (action.kind === "open_course") {
    store.restore({ ...state, views: { ...state.views, [state.program]: { semester: state.views[state.program]?.semester ?? 1, selectedCourseId: action.course_id } } });
    return;
  }
  if (action.kind !== "remove_course_from_plan") {
    if (!store.validSlot(action.semester_slot) || state.completed.includes(action.course_id)) fail("Invalid destination or completed course.");
    if (isNamedSlot(action.semester_slot) && action.semester_slot !== `${action.target_term?.season}-${action.target_term?.year}`) fail("The optional slot does not match the verified term.");
  }
  if (action.kind === "add_course_to_plan") {
    if (previous && previous.semester !== action.semester_slot) fail("This course is already planned in another semester. Use move instead.");
    if (!previous) store.setPlan(action.course_id, action.semester_slot);
  } else {
    if (!previous || previous.semester !== action.previous_semester_slot || previous.status !== action.previous_status || (action.source_semester_slot != null && action.source_semester_slot !== previous.semester)) fail("The course is no longer in the expected source semester.");
    if (action.kind === "remove_course_from_plan") store.removePlan(action.course_id);
    else {
      if (action.semester_slot === previous.semester) fail("The course is already in that semester.");
      store.setPlan(action.course_id, action.semester_slot, previous.status);
    }
  }
  const after = store.getState();
  store.restore({ ...after, views: { ...after.views, [after.program]: { semester: action.kind === "remove_course_from_plan" ? previous.semester : action.semester_slot, selectedCourseId: null } } });
}
