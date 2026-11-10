import type { Course, ProgramCatalog, RequirementItem } from "./course-types";

export type ChoiceCategory = "ge" | "technical" | "university" | "review";

export function requirementCategory(item: RequirementItem): ChoiceCategory {
  const label = `${item.label ?? ""} ${item.description ?? ""}`;
  return /technical.*elective/i.test(label) ? "technical" : /\bGE\b|general education/i.test(label) ? "ge" : /elective/i.test(label) ? "university" : "review";
}

export function geAreas(description: string): string[] {
  // Only explicit satisfaction statements are evidence, never prerequisite text.
  const matches = description.matchAll(/Satisfies\s+(UD\s+)?GE\s+Area\s*:?\s*([1-6][A-C]?(?:\s*(?:,|and|&)\s*[1-6][A-C]?)*)/gi);
  return [...matches].flatMap(match => (match[2].match(/[1-6][A-C]?/gi) ?? []).map(area => `${match[1] ? "UD " : ""}${area.toUpperCase()}`));
}

export function requirementMatches(course: Course, item: RequirementItem, catalog: ProgramCatalog): boolean {
  const category = requirementCategory(item);
  if (category === "review") return false;
  if (category === "technical") return course.plannerCategory === "technical";
  if (category === "university") return course.plannerCategory === "university";
  const area = item.label?.match(/\b(UD\s+)?(?:GE\s+)?Area\s*:?\s*([1-6][A-C]?)/i);
  if (!area) return geAreas(course.description).length > 0;
  const target = `${area[1] ? "UD " : ""}${area[2].toUpperCase()}`;
  const matches = geAreas(course.description).includes(target);
  const institutions = !/\+\s*US\b/i.test(item.label ?? "") || /\bUS\s*[123]\b/i.test(course.description);
  return matches && institutions && !catalog.requirementGroups.some(group => group.items.some(item => item.courseId === course.id));
}
