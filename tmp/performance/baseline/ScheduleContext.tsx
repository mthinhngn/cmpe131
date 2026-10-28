import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCatalog } from "./CatalogContext";
import type { CourseOffering } from "./types";
import { detectTimeConflicts } from "./schedule";

const STORAGE_KEY = "course-radar-schedules-v1";

type StoredSchedules = {
  schemaVersion: 1;
  selectionsByScope: Record<string, string[]>;
};

type ScheduleContextValue = {
  selectedClassNumbers: string[];
  selectedOfferings: CourseOffering[];
  isSelected: (classNumber: string) => boolean;
  hasSelectedComponent: (offering: CourseOffering) => boolean;
  selectOffering: (offering: CourseOffering) => void;
  removeOffering: (classNumber: string) => void;
  replaceSchedule: (classNumbers: string[], lockedClassNumbers?: string[]) => { ok: true } | { ok: false; error: string };
};

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

function readStoredSchedules(): StoredSchedules {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredSchedules> | null;
    if (parsed?.schemaVersion !== 1 || !parsed.selectionsByScope || typeof parsed.selectionsByScope !== "object") throw new Error("Invalid schedule state");
    const selectionsByScope = Object.fromEntries(Object.entries(parsed.selectionsByScope)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.filter((item): item is string => typeof item === "string")]));
    return { schemaVersion: 1, selectionsByScope };
  } catch {
    return { schemaVersion: 1, selectionsByScope: {} };
  }
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { catalog, program } = useCatalog();
  const [stored, setStored] = useState<StoredSchedules>(readStoredSchedules);
  const scopeKey = `${program}:${catalog.catalogYear}:${catalog.currentTerm.id}`;
  const selectedClassNumbers = stored.selectionsByScope[scopeKey] ?? [];
  const selectedOfferings = useMemo(() => {
    const selected = new Set(selectedClassNumbers);
    return catalog.offerings.filter((offering) => selected.has(offering.classNumber));
  }, [catalog.offerings, selectedClassNumbers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [stored]);

  const updateSelection = (update: (current: string[]) => string[]) => {
    setStored((current) => ({
      schemaVersion: 1,
      selectionsByScope: {
        ...current.selectionsByScope,
        [scopeKey]: update(current.selectionsByScope[scopeKey] ?? []),
      },
    }));
  };

  const value = useMemo<ScheduleContextValue>(() => ({
    selectedClassNumbers,
    selectedOfferings,
    isSelected: (classNumber) => selectedClassNumbers.includes(classNumber),
    hasSelectedComponent: (offering) => selectedOfferings.some((selected) => selected.courseCode === offering.courseCode && selected.component === offering.component),
    selectOffering: (offering) => updateSelection((current) => {
      const sameComponent = new Set(catalog.offerings
        .filter((candidate) => candidate.courseCode === offering.courseCode && candidate.component === offering.component)
        .map((candidate) => candidate.classNumber));
      return [...current.filter((classNumber) => !sameComponent.has(classNumber)), offering.classNumber];
    }),
    removeOffering: (classNumber) => updateSelection((current) => current.filter((item) => item !== classNumber)),
    replaceSchedule: (classNumbers, lockedClassNumbers = selectedClassNumbers) => {
      const requested = [...new Set(classNumbers)];
      const hardLocks = new Set([...selectedClassNumbers, ...lockedClassNumbers]);
      const missingLocks = [...hardLocks].filter((classNumber) => !requested.includes(classNumber));
      if (missingLocks.length) return { ok: false, error: `The proposal would remove locked class ${missingLocks.join(", ")}. Remove it manually first if you want the agent to replace it.` };
      const byClassNumber = new Map(catalog.offerings.map((offering) => [offering.classNumber, offering]));
      const offerings = requested.flatMap((classNumber) => byClassNumber.get(classNumber) ?? []);
      if (offerings.length !== requested.length) return { ok: false, error: "The proposal contains a section outside the current catalog snapshot." };
      const closedNew = offerings.filter((offering) => offering.openSeats <= 0 && !hardLocks.has(offering.classNumber));
      if (closedNew.length) return { ok: false, error: "The proposal contains a new section with no open seats." };
      const componentKeys = offerings.map((offering) => `${offering.courseCode}:${offering.component}`);
      if (new Set(componentKeys).size !== componentKeys.length) return { ok: false, error: "The proposal contains more than one section for the same course component." };
      if (detectTimeConflicts(offerings).length) return { ok: false, error: "The proposal contains a confirmed meeting conflict." };
      updateSelection(() => requested);
      return { ok: true };
    },
  }), [catalog.offerings, selectedClassNumbers, selectedOfferings, scopeKey]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}
