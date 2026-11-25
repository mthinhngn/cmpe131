import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { authRequest, useAuth } from "./AuthContext";
import { PersistentPlanningStore } from "./PersistentPlanningStore";
import { derivedTermSlots, type PlanSlot } from "./academicProfile";
import { apiEndpoint } from "./api";
import type { ProgramCatalog } from "./types";
import "./persistence.css";
import { PageLoading } from "./PageLoading";

export type PlanChange = { id: string; semester?: PlanSlot; status?: "planned" | "in-progress" };
type WhatIfState = { program: string; catalog: ProgramCatalog } | null;
type WhatIfStatus = "idle" | "loading" | "ready" | "error";

const WHAT_IF_SESSION_KEY = "course-radar:what-if-major";
const WHAT_IF_PATHS = new Set(["/overview", "/roadmap"]);
type StoredWhatIf = { currentMajor: string; previewProgram: string };

function readStoredWhatIf(): StoredWhatIf | null {
  if (typeof window === "undefined" || !WHAT_IF_PATHS.has(window.location.pathname.replace(/\/$/, "") || "/")) return null;
  try {
    const raw = window.sessionStorage.getItem(WHAT_IF_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredWhatIf>;
    return typeof value.currentMajor === "string" && typeof value.previewProgram === "string"
      ? { currentMajor: value.currentMajor, previewProgram: value.previewProgram }
      : null;
  } catch { return null; }
}

function clearStoredWhatIf() {
  try { window.sessionStorage.removeItem(WHAT_IF_SESSION_KEY); } catch { /* storage may be unavailable */ }
}

function usePlanning() {
  const { user, update } = useAuth();
  const store = useMemo(() => new PersistentPlanningStore(user?.id ?? null), [user?.id]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [selectedCourseId, selectCourse] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfState>(null);
  const [whatIfStatus, setWhatIfStatus] = useState<WhatIfStatus>("idle");
  const [whatIfError, setWhatIfError] = useState("");

  useEffect(() => { void store.load(); }, [store]);

  // Publish accepted database state before callers construct their acknowledgement.
  const command = async (kind: string, args: object = {}) => {
    const result = await store.command(kind, args);
    flushSync(() => {});
    if (result.status === "error") throw Error(result.message);
    return result;
  };

  const currentMajor = user?.major || state.program;

  const exitWhatIf = useCallback(() => {
    clearStoredWhatIf();
    setWhatIf(null);
    setWhatIfStatus("idle");
    setWhatIfError("");
  }, []);

  const startWhatIf = useCallback(async (program: string) => {
    if (!/^[a-z0-9-]{1,120}$/.test(program)) {
      setWhatIfStatus("error");
      setWhatIfError("Choose a valid major to preview.");
      return;
    }
    if (program === currentMajor) { exitWhatIf(); return; }
    setWhatIfStatus("loading");
    setWhatIfError("");
    try {
      const response = await fetch(apiEndpoint(`bootstrap?program=${encodeURIComponent(program)}`), { signal: AbortSignal.timeout(15000) });
      let payload: { catalog?: ProgramCatalog; message?: string };
      try { payload = await response.json(); }
      catch { throw Error("The program preview returned an invalid response."); }
      if (!response.ok || !payload.catalog) throw Error(typeof payload.message === "string" ? payload.message : "Could not load that major preview.");
      setWhatIf({ program, catalog: payload.catalog });
      setWhatIfStatus("ready");
      try { window.sessionStorage.setItem(WHAT_IF_SESSION_KEY, JSON.stringify({ currentMajor, previewProgram: program })); }
      catch { /* preview still works for this page if storage is unavailable */ }
    } catch (error) {
      setWhatIf(null);
      setWhatIfStatus("error");
      setWhatIfError(error instanceof Error ? error.message : "Could not load that major preview.");
    }
  }, [currentMajor, exitWhatIf]);

  useEffect(() => {
    if (!state.hydrated || whatIf || whatIfStatus !== "idle") return;
    const saved = readStoredWhatIf();
    if (!saved) return;
    if (saved.currentMajor !== currentMajor || saved.previewProgram === currentMajor) {
      clearStoredWhatIf();
      return;
    }
    void startWhatIf(saved.previewProgram);
  }, [state.hydrated, currentMajor, startWhatIf, whatIf, whatIfStatus]);

  useEffect(() => {
    if (whatIf?.program === currentMajor) exitWhatIf();
  }, [currentMajor, exitWhatIf, whatIf?.program]);

  const activeProgram = whatIf?.program ?? state.program;
  const baseCatalog = whatIf?.catalog ?? state.catalog;
  const startingTerm = user?.startingSemester.trim().toLowerCase().replace(/\s+/, "-") || state.startingTerms?.[state.program] || null;
  const activeChoices = whatIf ? {} : state.requirementChoices?.[state.program] ?? {};
  const requirementChoices = activeChoices;
  const degreeCatalog = useMemo(() => {
    const choices = activeChoices;
    const ids = new Set([...(baseCatalog.roadmapCourseIds ?? baseCatalog.courses.map(c => c.id)), ...Object.values(choices)]);
    return { ...baseCatalog, courses: baseCatalog.courses.filter(c => ids.has(c.id)),
      requirementGroups: baseCatalog.requirementGroups.map(group => ({ ...group, items: group.items.map(item =>
        item.type === "placeholder" && choices[item.id] ? { ...item, courseId: choices[item.id] } : item) })) };
  }, [baseCatalog, activeChoices]);
  const takenCourseIds = useMemo(() => new Set(state.completed), [state.completed]);
  const previewSemesterCount = useMemo(() => Math.max(1, degreeCatalog.requirementGroups.length, ...degreeCatalog.courses.map(course => Number(course.recommendedSemester) || 0)), [degreeCatalog]);
  const semesterCount = whatIf ? previewSemesterCount : store.semesterCount;
  const semesterSlots = useMemo<number[]>(() => whatIf ? Array.from({ length: previewSemesterCount }, (_, index) => index + 1) : store.semesterSlots, [whatIf, previewSemesterCount, store, state.semesterSlots, state.counts, state.plans, state.catalog, state.program]);
  const termOrder = useMemo<PlanSlot[]>(() => whatIf ? semesterSlots : store.termOrder, [whatIf, semesterSlots, store, state.namedTerms, state.termOrder, state.program]);
  const termToSlot = useMemo(() => Object.fromEntries(Object.entries(derivedTermSlots(startingTerm, semesterCount)).filter(([, slot]) => semesterSlots.includes(slot))), [startingTerm, semesterCount, semesterSlots]);
  const courseById = useMemo(() => new Map(baseCatalog.courses.map(c => [c.id, c])), [baseCatalog.courses]);
  const plans = whatIf ? {} : state.plans[state.program] ?? {};

  return {
    planningStore: store, requirementChoices, hydrated: state.hydrated, storageStatus: state.storageStatus,
    selectedCourseId, selectCourse, startingTerm,
    currentMajor, isWhatIf: !!whatIf, previewProgram: whatIf?.program ?? null, whatIfStatus, whatIfError, startWhatIf, exitWhatIf,
    setStartingTerm: async (term: string | null) => {
      if (user) {
        if (!term) throw Error("Set your account starting semester in My profile.");
        const [season, year] = term.split("-");
        const result = await authRequest("profile", { name: user.name, major: user.major, startingSemester: `${season[0].toUpperCase()}${season.slice(1)} ${year}` });
        update(result.user);
      } else await command("setStartingTerm", { term });
    },
    termToSlot,
    mapTerm: (term: string, slot: number | null) => { if (slot !== null && derivedTermSlots(startingTerm, semesterCount)[term] !== slot) throw Error("Term disagrees with saved profile."); },
    plans, semesterCount, semesterSlots, termOrder,
    additionalPrograms: whatIf ? [] : state.additionalPrograms?.[state.program] ?? [],
    namedTerms: whatIf ? [] : state.namedTerms?.[state.program] ?? [], schedules: state.schedules,
    setPlan: async (id: string, semester: PlanSlot, status: "planned" | "in-progress" = "planned") => (await store.setPlan(id, semester, status)).status !== "error",
    removePlan: async (id: string) => (await store.removePlan(id)).status !== "error",
    addSemester: () => { void command("addSemester"); },
    removeLastSemester: () => { void command("removeLastSemester"); },
    toggleTakenCourse: (id: string) => { void command("toggleTakenCourse", { id }); },
    program: activeProgram, selectProgram: (program: string) => { void command("selectProgram", { program }); },
    catalog: degreeCatalog, allCourses: baseCatalog.courses, courseById,
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
