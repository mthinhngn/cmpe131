export const COURSE_CATEGORIES = ["major", "math", "science", "eng", "writing", "university", "technical", "choice"] as const;
export type CourseCategory = typeof COURSE_CATEGORIES[number];

export function courseCategory(code: string, inRoadmap = true): CourseCategory {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, " ");
  if (!inRoadmap) return "university";
  const subject = normalized.split(" ")[0];
  if (!subject) return "choice";
  if (["CMPE", "CS", "SE"].includes(subject)) return "major";
  if (subject === "MATH") return "math";
  if (["PHYS", "BIOL", "CHEM"].includes(subject)) return "science";
  if (subject === "ENGL") return "writing";
  return ["EE", "ENGR", "ISE"].includes(subject) ? "eng" : "major";
}
