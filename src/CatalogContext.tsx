import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { authRequest, useAuth } from "./AuthContext";
import { PersistentPlanningStore } from "./PersistentPlanningStore";
import { derivedTermSlots, type PlanSlot } from "./academicProfile";
import "./persistence.css";
import { PageLoading } from "./PageLoading";

export type PlanChange = { id: string; semester?: PlanSlot; status?: "planned" | "in-progress" };
function usePlanning() {
  const { user, update } = useAuth();
  const store = useMemo(() => new PersistentPlanningStore(user?.id ?? null), [user?.id]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [selectedCourseId, selectCourse] = useState<string | null>(null);
  useEffect(() => { void store.load(); }, [store]);
  // Publish accepted database state before callers construct their acknowledgement.
  const command = async (kind: string, args: object = {}) => {
    const result = await store.command(kind, args);
    flushSync(() => {});
    if (result.status === "error") throw Error(result.message);
    return result;
  };
  const startingTerm = user?.startingSemester.trim().toLowerCase().replace(/\s+/, "-") || state.startingTerms?.[state.program] || null;
  const courseById = useMemo(() => new Map(state.catalog.courses.map(c => [c.id, c])), [state.catalog.courses]);
  const requirementChoices = state.requirementChoices?.[state.program] ?? {};
  const degreeCatalog = useMemo(() => {
    const choices = state.requirementChoices?.[state.program] ?? {};
    const ids = new Set([...(state.catalog.roadmapCourseIds ?? state.catalog.courses.map(c => c.id)), ...Object.values(choices)]);
    return { ...state.catalog, courses: state.catalog.courses.filter(c => ids.has(c.id)),
      requirementGroups: state.catalog.requirementGroups.map(group => ({ ...group, items: group.items.map(item =>
        item.type === "placeholder" && choices[item.id] ? { ...item, courseId: choices[item.id] } : item) })) };
  }, [state.catalog, state.requirementChoices, state.program]);
  const takenCourseIds = useMemo(() => new Set(state.completed), [state.completed]);
  const semesterSlots = useMemo(() => store.semesterSlots, [store, state.semesterSlots, state.counts, state.plans, state.catalog, state.program]);
  const termOrder = useMemo(() => store.termOrder, [store, semesterSlots, state.namedTerms, state.termOrder, state.program]);
  const termToSlot = useMemo(() => Object.fromEntries(Object.entries(derivedTermSlots(startingTerm, store.semesterCount)).filter(([, slot]) => semesterSlots.includes(slot))), [startingTerm, store.semesterCount, semesterSlots]);
  return {
    planningStore: store, requirementChoices, hydrated: state.hydrated, storageStatus: state.storageStatus,
    selectedCourseId, selectCourse, startingTerm,
    setStartingTerm: async (term: string | null) => {
      if (user) {
        if (!term) throw Error("Set your account starting semester in My profile.");
        const [season, year] = term.split("-");
        const result = await authRequest("profile", { name: user.name, major: user.major, startingSemester: `${season[0].toUpperCase()}${season.slice(1)} ${year}` });
        update(result.user);
      } else await command("setStartingTerm", { term });
    },
    termToSlot,
    mapTerm: (term: string, slot: number | null) => { if (slot !== null && derivedTermSlots(startingTerm, store.semesterCount)[term] !== slot) throw Error("Term disagrees with saved profile."); },
    plans: state.plans[state.program] ?? {}, semesterCount: store.semesterCount, semesterSlots, termOrder,
    additionalPrograms: state.additionalPrograms?.[state.program] ?? [],
    namedTerms: state.namedTerms?.[state.program] ?? [], schedules: state.schedules,
    setPlan: async (id: string, semester: PlanSlot, status: "planned" | "in-progress" = "planned") => (await store.setPlan(id, semester, status)).status !== "error",
    removePlan: async (id: string) => (await store.removePlan(id)).status !== "error",
    addSemester: () => { void command("addSemester"); },
    removeLastSemester: () => { void command("removeLastSemester"); },
    toggleTakenCourse: (id: string) => { void command("toggleTakenCourse", { id }); },
    program: state.program, selectProgram: (program: string) => { void command("selectProgram", { program }); },
    catalog: degreeCatalog, allCourses: state.catalog.courses, courseById,
    takenCourseIds, mode: (state.hydrated ? "database" : "loading") as "database" | "loading" | "fixture",
    retry: () => { void store.retry(); }, storageError: state.storageError,
  };
}
const CatalogContext = createContext<ReturnType<typeof usePlanning> | null>(null);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const value = usePlanning();
  const store = value.planningStore;
  // Queued changes show before they are saved; warn before the tab closes and drops them.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (store.hasQueuedChanges) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [store]);
  if (!value.hydrated && value.storageStatus !== "error") return <PageLoading detail="Restoring your saved plan" />;
  return <CatalogContext.Provider value={value}>
    {!["saved", "saving"].includes(value.storageStatus) && <div className="persistence-status" data-status={value.storageStatus} role={value.storageStatus === "error" ? "alert" : "status"}>{value.storageError || (value.hydrated ? "Saving your workspace…" : "Loading your workspace…")}{value.storageStatus === "error" && <button onClick={value.retry}>Retry save</button>}</div>}
    <fieldset className="persistence-content" disabled={!value.hydrated || value.storageStatus === "error"}>{value.hydrated ? children : null}</fieldset>
  </CatalogContext.Provider>;
}
export function useCatalog() { const value = useContext(CatalogContext); if (!value) throw Error("Catalog provider missing"); return value; }
