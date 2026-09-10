import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computerEngineeringCatalog } from "./data";
import type { Course, ProgramCatalog } from "./types";

type CatalogContextValue = {
  catalog: ProgramCatalog;
  courseById: Map<string, Course>;
  mode: "loading" | "database" | "fixture";
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState(computerEngineeringCatalog);
  const [mode, setMode] = useState<CatalogContextValue["mode"]>("loading");

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
    fetch(`${apiUrl}/bootstrap`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json() as Promise<{ catalog: ProgramCatalog }>;
      })
      .then((payload) => {
        if (!payload.catalog?.requirementGroups?.length) throw new Error("API response has no requirement groups");
        setCatalog(payload.catalog);
        setMode("database");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMode("fixture");
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({
    catalog,
    courseById: new Map(catalog.courses.map((course) => [course.id, course])),
    mode,
  }), [catalog, mode]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used inside CatalogProvider");
  return context;
}
