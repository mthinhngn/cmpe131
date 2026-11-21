import type { Course, ProgramCatalog, RequirementItem } from "./course-types";
import { requirementName, universityRequirement } from "./graduation-requirements";

export type ChoiceCategory = "ge" | "technical" | "university" | "review";

export function requirementCategory(item: RequirementItem): ChoiceCategory {
  const label = `${item.label ?? ""} ${item.description ?? ""}`;
  return /technical.*elective/i.test(label) ? "technical" : /\bGE\b|general education/i.test(label) ? "ge" : /elective/i.test(label) ? "university" : "review";
}

export function geAreas(description: string): string[] {
  // Only explicit satisfaction statements are evidence, never prerequisite text.
  const matches = description.matchAll(/Satisfies\s+(UD\s+)?GE\s+Area\s*:?\s*((?:[1-6][A-C]?|[A-F][1-4]?)(?:\s*(?:,|and|&)\s*(?:[1-6][A-C]?|[A-F][1-4]?))*)/gi);
  return [...matches].flatMap(match => (match[2].match(/\b(?:[1-6][A-C]?|[A-F][1-4]?)\b/gi) ?? []).map(area => `${match[1] ? "UD " : ""}${area.toUpperCase()}`));
}

export function catalogDesignations(description: string): string[] {
  const statements = description.match(/Satisfies\b[^.\n]*/gi) ?? [];
  return [...geAreas(description).map(area => area.startsWith("UD ") ? area : `GE ${area}`),
    ...statements.flatMap(statement => statement.match(/\b(?:US[123]|WID|GWAR|PE)\b/gi) ?? []).map(tag => tag.toUpperCase())];
}

export function requirementMatches(course: Course, item: RequirementItem, catalog: ProgramCatalog): boolean {
  const label = requirementName(item.label ?? "").replace(/\s+\d+ unit.*$/, "");
  const choices = (catalog.requirementEvidence ?? []).filter(section => section.choice && requirementName(section.title).replace(/\s+\d+ unit.*$/, "") === label);
  if (choices.length) return choices.length === 1 && choices[0].courses.some(option => option.code === course.code);
  const school = universityRequirement(label);
  if (school?.attributes) return school.attributes.some(tag => catalogDesignations(course.description).includes(tag))
    && !catalog.requirementGroups.some(group => group.items.some(required => required.courseId === course.id));
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
