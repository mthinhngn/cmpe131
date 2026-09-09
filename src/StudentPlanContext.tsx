import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { MAJOR, roadmaps } from "./data";
import { PLAN_STORAGE_KEY, emptyPlan, parseStoredPlan } from "./planner";
import type { StudentPlan } from "./types";

type PlanContextValue = {
  plan: StudentPlan;
  toggleCompleted: (courseId: string) => void;
  toggleSection: (sectionId: string, siblingSectionIds?: string[]) => void;
  replacePlan: (plan: StudentPlan) => void;
  clearPlan: () => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function StudentPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState(() => parseStoredPlan(localStorage.getItem(PLAN_STORAGE_KEY), MAJOR, roadmaps[MAJOR].catalog));

  const persist = (next: StudentPlan) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setPlan(stamped);
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(stamped));
  };

  const value = useMemo<PlanContextValue>(() => ({
    plan,
    toggleCompleted: (courseId) => persist({
      ...plan,
      completedCourseIds: plan.completedCourseIds.includes(courseId)
        ? plan.completedCourseIds.filter((id) => id !== courseId)
        : [...plan.completedCourseIds, courseId],
    }),
    toggleSection: (sectionId, siblingSectionIds = []) => persist({
      ...plan,
      selectedSectionIds: plan.selectedSectionIds.includes(sectionId)
        ? plan.selectedSectionIds.filter((id) => id !== sectionId)
        : [...plan.selectedSectionIds.filter((id) => !siblingSectionIds.includes(id)), sectionId],
    }),
    replacePlan: persist,
    clearPlan: () => persist(emptyPlan(plan.major, plan.catalog)),
  }), [plan]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function useStudentPlan() {
  const context = useContext(PlanContext);
  if (!context) throw new Error("useStudentPlan must be used inside StudentPlanProvider");
  return context;
}
