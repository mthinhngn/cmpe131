import type { CourseOffering } from "./types";
import type { PlanSlot } from "./academicProfile";

export function nextRegularTerm(term: string): string {
  const [season, year] = term.split("-");
  return season === "fall" ? `spring-${Number(year) + 1}` : `fall-${year}`;
}
export function termName(term: string): string {
  const [season, year] = term.split("-");
  return `${season[0].toUpperCase()}${season.slice(1)} ${year}`;
}
export function termForSlot(mapping: Record<string, number>, slot: PlanSlot | undefined): string | undefined {
  return typeof slot === "string" ? slot : Object.keys(mapping).find(term => mapping[term] === slot);
}
export function scheduleScope(program: string, catalogYear: string, term: string) {
  return `${program}:${catalogYear}:${term}`;
}
export function requiredComponents(offerings: CourseOffering[]) {
  return [...new Set(offerings.map(o => o.component))];
}
