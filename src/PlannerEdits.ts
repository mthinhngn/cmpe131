import type { Plan } from "./planning";

export type PlannerEdit = { plan?: Plan | null; completed?: boolean };

// Previews stay local to Planner; the shared store only publishes accepted saves.
export class PlannerEdits {
  private edits: Record<string, PlannerEdit> = {};
  private listeners = new Set<() => void>();
  getState = () => this.edits;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private emit() { this.listeners.forEach(listener => listener()); }
  async run(id: string, preview: PlannerEdit, save: () => Promise<void>, onError: (error: unknown) => void) {
    if (this.edits[id]) return false;
    this.edits = { ...this.edits, [id]: preview };
    this.emit();
    try { await save(); return true; }
    catch (error) { onError(error); return false; }
    finally {
      const next = { ...this.edits };
      delete next[id];
      this.edits = next;
      this.emit();
    }
  }
}
