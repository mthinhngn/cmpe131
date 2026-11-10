export const COURSE_CATEGORIES = ["major", "math", "science", "eng", "writing", "university", "technical", "choice"] as const;
export type CourseCategory = typeof COURSE_CATEGORIES[number];

// SJSU department lists, checked 2026-11-07. Keep catalog-conditional entries out of broad matches.
// https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/bcce-technical-electives.php
// https://www.sjsu.edu/cmpe/undergraduate_programs/bs-software-engineering/bsse-technical-electives.php
const technical: Record<string, ReadonlySet<string>> = {
  "computer-engineering": new Set([
    "CMPE 132", "CMPE 133", "CMPE 135", "CMPE 137", "CMPE 138", "CMPE 139", "CMPE 143",
    "CMPE 147", "CMPE 149", "CMPE 150", "CMPE 163", "CMPE 164", "CMPE 165", "CMPE 172",
    "CMPE 180-02", "CMPE 181", "CMPE 182", "CMPE 183", "CMPE 185", "CMPE 187", "CMPE 188",
    "CMPE 189", "CS 151", "CS 157B", "CS 166", "SE 166",
  ]),
  "software-engineering": new Set([
    "CMPE 137", "CMPE 139", "CMPE 149", "CMPE 152", "CMPE 181", "CMPE 182", "CMPE 185",
    "CMPE 188", "CMPE 189", "CS 116A", "CS 123A", "CS 134", "CS 152", "CS 155", "CS 156",
    "CS 157B", "CS 158B", "CS 159", "CS 174",
  ]),
};

export function courseCategory(code: string, inRoadmap = true, program = "computer-engineering"): CourseCategory {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, " ");
  if (!inRoadmap) return technical[program]?.has(normalized) ? "technical" : "university";
  const subject = normalized.split(" ")[0];
  if (!subject) return "choice";
  if (["CMPE", "CS", "SE"].includes(subject)) return "major";
  if (subject === "MATH") return "math";
  if (["PHYS", "BIOL", "CHEM"].includes(subject)) return "science";
  if (subject === "ENGL") return "writing";
  return ["EE", "ENGR", "ISE"].includes(subject) ? "eng" : "major";
}
