const storageKey = "course-radar-progress-session-v1";
export type ProgressSession = { program: string; completedCourseIds: string[] };

export function readProgressSession(storage?: Pick<Storage, "getItem">): ProgressSession {
  const empty = { program: "computer-engineering", completedCourseIds: [] };
  try {
    const value = JSON.parse(storage?.getItem(storageKey) ?? "null");
    if (!value || typeof value !== "object") return empty;
    return {
      program: value.program === "software-engineering" ? value.program : "computer-engineering",
      completedCourseIds: Array.isArray(value.completedCourseIds)
        ? [...new Set<string>(value.completedCourseIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0))] : [],
    };
  } catch { return empty; }
}

export function writeProgressSession(value: ProgressSession, storage?: Pick<Storage, "setItem">) {
  try { storage?.setItem(storageKey, JSON.stringify(value)); } catch { /* Keep the in-memory draft usable when storage is blocked. */ }
}

export function progressStorage(): Storage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}
