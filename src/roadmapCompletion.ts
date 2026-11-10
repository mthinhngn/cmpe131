import { useMemo, useSyncExternalStore } from "react";
import { useCatalog } from "./CatalogContext";
import { PlannerEdits } from "./PlannerEdits";

// Roadmap completion previews: flip immediately, save through the shared store, revert on failure.
const edits = new PlannerEdits();
let lastError = "";
const errorListeners = new Set<() => void>();
const setLastError = (message: string) => { lastError = message; errorListeners.forEach(listener => listener()); };

export function useRoadmapTakenIds() {
  const { takenCourseIds } = useCatalog();
  const pending = useSyncExternalStore(edits.subscribe, edits.getState);
  return useMemo(() => {
    if (!Object.keys(pending).length) return takenCourseIds;
    const next = new Set(takenCourseIds);
    for (const [id, edit] of Object.entries(pending)) {
      if (edit.completed === true) next.add(id);
      else if (edit.completed === false) next.delete(id);
    }
    return next;
  }, [takenCourseIds, pending]);
}

export function useRoadmapCompletionError() {
  return useSyncExternalStore(listener => { errorListeners.add(listener); return () => { errorListeners.delete(listener); }; }, () => lastError);
}
export const clearRoadmapCompletionError = () => setLastError("");

export function useToggleRoadmapCompletion() {
  const { takenCourseIds, planningStore } = useCatalog();
  return (id: string) => {
    if (edits.getState()[id]) return;
    setLastError("");
    void edits.run(id, { completed: !takenCourseIds.has(id) }, async () => {
      const result = await planningStore.command("toggleTakenCourse", { id });
      if (result.status === "error") throw Error(result.message);
    }, error => setLastError(error instanceof Error ? error.message : "Could not save. Try again."));
  };
}
