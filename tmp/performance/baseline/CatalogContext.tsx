import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computerEngineeringCatalog } from "./data";
import { softwareEngineeringCatalog } from "./softwareEngineeringData";
import type { Course, ProgramCatalog } from "./types";
import { apiEndpoint } from "./api";
import { progressStorage, readProgressSession, writeProgressSession } from "./progressSession";

type CatalogContextValue = {
  plans: Record<string, { status: "planned" | "in-progress"; semester: number }>;
  setPlan: (id: string, semester: number, status?: "planned" | "in-progress") => void;
  removePlan: (id: string) => void;
  semesterCount: number;
  addSemester: () => void;
  removeLastSemester: () => void;
  retry: () => void;
  takenCourseIds: Set<string>;
  toggleTakenCourse: (id: string) => void;
  program: string;
  selectProgram: (program: string) => void;
  catalog: ProgramCatalog;
  courseById: Map<string, Course>;
  mode: "loading" | "database" | "fixture";
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [savedProgress] = useState(() => readProgressSession(progressStorage()));
  const [planByProgram, setPlanByProgram] = useState<Record<string, Record<string, { status: "planned" | "in-progress"; semester: number }>>>({});
  const [semesterCountByProgram, setSemesterCountByProgram] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState(0);
  const [takenCourseIds, setTakenCourseIds] = useState<Set<string>>(() => new Set(savedProgress.completedCourseIds));
  const [program, setProgram] = useState(savedProgress.program);
  const [catalog, setCatalog] = useState(savedProgress.program === "software-engineering" ? softwareEngineeringCatalog : computerEngineeringCatalog);
  const [mode, setMode] = useState<CatalogContextValue["mode"]>("loading");

  useEffect(() => {
    writeProgressSession({ program, completedCourseIds: [...takenCourseIds] }, progressStorage());
  }, [program, takenCourseIds]);

  useEffect(() => {
    const controller = new AbortController();
    const fixture = program === "software-engineering" ? softwareEngineeringCatalog : computerEngineeringCatalog;
    setCatalog(fixture);
    setMode("loading");
    fetch(apiEndpoint(`bootstrap?program=${encodeURIComponent(program)}`), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<{ catalog: ProgramCatalog }>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!payload.catalog?.requirementGroups?.length || payload.catalog.name !== fixture.name || payload.catalog.catalogYear !== "2026-2027" || !payload.catalog.currentTerm || !Array.isArray(payload.catalog.offerings)) throw new Error("API catalog is unavailable for this program");
        setCatalog(payload.catalog);
        setMode("database");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMode("fixture");
      });
    return () => controller.abort();
  }, [program, attempt]);

  const minimumSemesterCount = catalog.requirementGroups.length;
  const semesterCount = Math.max(minimumSemesterCount, semesterCountByProgram[program] ?? 0, ...Object.values(planByProgram[program] ?? {}).map(plan => plan.semester));

  const value = useMemo(() => ({
    plans: planByProgram[program] ?? {},
    semesterCount,
    addSemester: () => setSemesterCountByProgram(previous => ({ ...previous, [program]: Math.max(previous[program] ?? minimumSemesterCount, semesterCount) + 1 })),
    removeLastSemester: () => setSemesterCountByProgram(previous => {
      const count = Math.max(previous[program] ?? minimumSemesterCount, minimumSemesterCount);
      if (count <= minimumSemesterCount || Object.values(planByProgram[program] ?? {}).some(plan => plan.semester === count)) return previous;
      return { ...previous, [program]: count - 1 };
    }),
    setPlan: (id: string, semester: number, status: "planned" | "in-progress" = "planned") => {
      setSemesterCountByProgram(previous => ({ ...previous, [program]: Math.max(previous[program] ?? minimumSemesterCount, semester) }));
      setPlanByProgram(previous => ({ ...previous, [program]: { ...previous[program], [id]: { semester, status } } }));
      setTakenCourseIds(previous => { const next = new Set(previous); next.delete(id); return next; });
    },
    removePlan: (id: string) => setPlanByProgram(previous => { const next = { ...previous[program] }; delete next[id]; return { ...previous, [program]: next }; }),
    retry: () => setAttempt(previous => previous + 1),
    takenCourseIds,
    toggleTakenCourse: (id: string) => setTakenCourseIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    program,
    selectProgram: setProgram,
    catalog,
    courseById: new Map(catalog.courses.map((course) => [course.id, course])),
    mode,
  }), [catalog, mode, program, takenCourseIds, planByProgram, semesterCount, minimumSemesterCount]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside CatalogProvider");
  return context;
}
