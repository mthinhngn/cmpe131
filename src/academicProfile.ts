/** Browser-local profile, separate from the tab's completion draft and in-memory plan. */
const profileKey = "course-radar-academic-profile-v1";
export function isStartingTerm(value: unknown): value is string {
  return typeof value === "string" && /^(winter|spring|summer|fall)-(19|20|21)\d{2}$/.test(value);
}
export function readStartingTerm(storage?: Pick<Storage, "getItem">): string | null {
  try {
    const profile = JSON.parse(storage?.getItem(profileKey) ?? "null");
    return isStartingTerm(profile?.startingTerm) ? profile.startingTerm : null;
  } catch { return null; }
}
export function saveStartingTerm(value: string | null, storage?: Pick<Storage, "setItem">) {
  if (value !== null && !isStartingTerm(value)) throw new Error("Choose a valid starting academic term.");
  if (!storage) throw new Error("Browser storage is unavailable. Allow local storage to save your starting term.");
  storage.setItem(profileKey, JSON.stringify({ startingTerm: value }));
}
export function profileStorage(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
export type PlanSlot = number | string;
export function isNamedTerm(value: unknown): value is string {
  return typeof value === "string" && /^(winter|summer)-(19|20|21)\d{2}$/.test(value);
}
export function slotLabel(slot: PlanSlot): string {
  return typeof slot === "number" ? `Semester ${slot}` : slot.replace(/^(\w+)-(\d+)$/, (_, season, year) => `${season[0].toUpperCase()}${season.slice(1)} ${year}`);
}
export function parseSlot(value: string): PlanSlot {
  return isNamedTerm(value) ? value : Number(value);
}
export function derivedTermSlots(start: string | null, count: number): Record<string, number> {
  if (!isStartingTerm(start)) return {};
  const [season, year] = start.split("-");
  const first = Number(year) * 2 + Number(season === "fall" || season === "summer");
  return Object.fromEntries(Array.from({ length: count }, (_, i) => {
    const index = first + i;
    return [`${index % 2 ? "fall" : "spring"}-${Math.floor(index / 2)}`, i + 1];
  }));
}
