import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { allCourseById as fixtureCourseMap, getCourseSections as getFixtureSections, roadmaps as fixtureRoadmaps, sections as fixtureSections, type MajorName } from "./data";
import type { Course, Section } from "./types";

type Roadmap = {
  name: MajorName;
  abbreviation: string;
  catalog: string;
  sourceNote: string;
  sourceUrl: string;
  programUrl: string;
  semesterCount: number;
  courses: readonly Course[];
};
type CatalogMode = "loading" | "database" | "fixture";
type CatalogContextValue = {
  roadmaps: Record<MajorName, Roadmap>;
  sections: Section[];
  allCourseById: Map<string, Course>;
  getCourseSections: (courseId: string) => Section[];
  mode: CatalogMode;
};

type BootstrapResponse = {
  programs: Array<Omit<Roadmap, "sourceNote" | "programUrl"> & { name: MajorName }>;
  terms: Array<{ sections: Section[] }>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CatalogMode>("loading");
  const [roadmaps, setRoadmaps] = useState<Record<MajorName, Roadmap>>(() => ({ ...fixtureRoadmaps }));
  const [sections, setSections] = useState<Section[]>(fixtureSections);

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
    fetch(`${apiUrl}/bootstrap`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<BootstrapResponse>;
      })
      .then((payload) => {
        const next: Record<MajorName, Roadmap> = { ...fixtureRoadmaps };
        for (const program of payload.programs) {
          if (!(program.name in next)) continue;
          const existing = next[program.name];
          next[program.name] = { ...existing, ...program, sourceNote: `${program.name} roadmap loaded from PostgreSQL.`, programUrl: existing.programUrl };
        }
        setRoadmaps(next);
        setSections(payload.terms.flatMap((term) => term.sections));
        setMode("database");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMode("fixture");
      });
    return () => controller.abort();
  }, []);

  const allCourseById = useMemo(() => new Map(Object.values(roadmaps).flatMap((roadmap) => roadmap.courses).map((course) => [course.id, course])), [roadmaps]);
  const value = useMemo<CatalogContextValue>(() => ({
    roadmaps,
    sections,
    allCourseById: mode === "fixture" ? fixtureCourseMap : allCourseById,
    getCourseSections: (courseId) => {
      if (mode === "fixture") return getFixtureSections(courseId);
      const direct = sections.filter((section) => section.courseId === courseId);
      if (direct.length) return direct;
      const code = allCourseById.get(courseId)?.code;
      const aliasIds = [...allCourseById.values()].filter((course) => course.code === code).map((course) => course.id);
      return sections.filter((section) => aliasIds.includes(section.courseId));
    },
    mode,
  }), [allCourseById, mode, roadmaps, sections]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside CatalogProvider");
  return context;
}
