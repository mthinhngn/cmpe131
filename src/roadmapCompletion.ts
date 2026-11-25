import { useSyncExternalStore } from "react";
import { useCatalog } from "./CatalogContext";

// The planning store shows the change immediately and queues the save; failures surface here.
let lastError = "";
const errorListeners = new Set<() => void>();
const setLastError = (message: string) => { lastError = message; errorListeners.forEach(listener => listener()); };

export function useRoadmapTakenIds() { return useCatalog().takenCourseIds; }

export function useRoadmapCompletionError() {
  return useSyncExternalStore(listener => { errorListeners.add(listener); return () => { errorListeners.delete(listener); }; }, () => lastError);
}
export const clearRoadmapCompletionError = () => setLastError("");
export const reportRoadmapError = (message: string) => setLastError(message);

export function useToggleRoadmapCompletion() {
  const { planningStore, isWhatIf } = useCatalog();
  return (id: string) => {
    setLastError("");
    if (isWhatIf) { setLastError("What-if Major is read-only. Exit What-if to change course completion."); return; }
    void planningStore.toggleTakenCourse(id).then(result => { if (result.status === "error") setLastError(result.message || "Could not save. Try again."); });
  };
}
