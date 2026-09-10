import { computerEngineeringCatalog, computerEngineeringCourses } from "./data";
import type { Course, ProgramCatalog, RequirementGroup, RequirementItem } from "./types";

const sourceUrl = "https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647";
const course = (id: string, code: string, title: string, units: number, recommendedSemester: number, coid: string, prerequisiteCourseIds: string[] = [], prerequisiteText = ""): Course => ({
  id, code, title, units, recommendedSemester, prerequisiteCourseIds, prerequisiteText, corequisiteCourseIds: [],
  description: `${title} in the official SJSU Software Engineering 2026-2027 roadmap.`,
  sourceUrl: `https://catalog.sjsu.edu/preview_course_nopop.php?catoid=23&coid=${coid}`,
});
const shared = (id: string, semester: number, overrides: Partial<Course> = {}): Course => {
  const original = computerEngineeringCourses.find((item) => item.id === id)!;
  return { ...original, recommendedSemester: semester, description: original.description.replace("Computer Engineering", "Software Engineering"), ...overrides };
};
const courses: Course[] = [
  course("se-cs46a", "CS 46A", "Introduction to Programming", 4, 1, "198970", [], "Math enrollment category M-I, M-II, or M-III and an approved major (including Software Engineering), or instructor consent."),
  shared("ce-engr10", 1), shared("ce-engl1a", 1), shared("ce-math30", 1),
  course("se-cs46b", "CS 46B", "Introduction to Data Structures", 4, 2, "198971", ["se-cs46a"], "CS 46A or CS 46AX with C- or better; CS 46AW also required if CS 46A was not taught in Java. Math placement/proficiency or catalog-listed MATH 19 / MATH 18A and 18B pathway; approved major or consent."),
  shared("ce-engl1b", 2), shared("ce-math42", 2), shared("ce-phys50", 2),
  shared("ce-cmpe131", 3, { prerequisiteCourseIds: ["se-cs46b"] }), shared("ce-math31", 3),
  course("se-cs146", "CS 146", "Data Structures and Algorithms", 3, 4, "198982", ["ce-math30", "ce-math42", "se-cs46b"], "MATH 30, MATH 42, and CS 46B, each C- or better. CS 48 or CS 49J additionally if CS 46B was not taught in Java; approved major or consent."),
  shared("ce-cmpe70", 4, { prerequisiteCourseIds: ["se-cs46b"] }),
  course("se-cmpe165", "CMPE 165", "Software Engineering Process Management", 3, 4, "198808", ["se-cs46a"], "CMPE 30 or CS 46A or equivalent with C- or better."),
  course("se-cmpe120", "CMPE 120", "Computer Organization and Architecture", 3, 5, "198754", ["se-cs46b", "ce-cmpe70"], "(CMPE 50 or CS 46B) and (CMPE 70 or CS 47), each C- or better; CMPE or SE majors."),
  course("se-cs149", "CS 149", "Operating Systems", 3, 5, "198984", ["ce-cmpe70", "se-cs146"], "(CS 47 or CMPE 70) and CS 146, each C- or better; approved major or consent."),
  course("se-cs157a", "CS 157A", "Introduction to Database Management Systems", 3, 5, "198991", ["se-cs146"], "CS 146 with C- or better; approved major or consent."),
  course("se-cmpe187", "CMPE 187", "Software Quality Engineering", 3, 5, "198813", ["ce-cmpe131"], "CMPE 131 with C- or better; CMPE or SE majors."),
  shared("ce-cmpe148", 6, { prerequisiteCourseIds: ["se-cmpe120", "se-cs146"], prerequisiteText: "For Software Engineering majors: CMPE 120 and CS 146, both C- or better." }),
  shared("ce-engr100w", 6), shared("ce-math33la", 6),
  course("se-math142", "MATH 142", "Introduction to Combinatorics", 3, 6, "200916", ["ce-math31", "ce-math42"], "MATH 31 and MATH 42, each C- or better, or instructor consent."),
  course("se-cmpe172", "CMPE 172", "Large Scale Systems", 3, 7, "198820", ["se-cs149"], "CMPE 142 or CS 149 with C- or better; CMPE or SE majors."),
  course("se-math161a", "MATH 161A", "Applied Probability and Statistics I", 3, 7, "200919", ["ce-math31"], "MATH 31 with C- or better, or instructor consent."),
  shared("ce-ise130", 7, { prerequisiteCourseIds: [], prerequisiteText: "MATH 32 (outside this roadmap); Engineering majors and graduate students." }),
  shared("ce-cmpe195a", 7, { prerequisiteCourseIds: ["se-cs146", "ce-cmpe131", "ce-engr100w"], prerequisiteText: "For SE majors: CS 146 and CMPE 131 with C- or better; ENGR 100W with C or better; core GE, upper-division standing, good standing and graduation application requirements. Corequisite ENGR 195A." }),
  course("se-cs166", "CS 166", "Information Security", 3, 7, "199022", ["se-cs146", "ce-cmpe70"], "CS 146 and one of CS 47, CMPE 70, or CMPE 120, each C- or better; approved major or consent. Chart shows the CMPE 70 pathway, not all alternatives as mandatory."),
  shared("ce-engr195a", 7), shared("ce-cmpe195b", 8), shared("ce-engr195b", 8),
  course("se-ise164", "ISE 164", "Computer and Human Interaction", 3, 8, "200367", [], "Junior standing."),
];
const items = (...ids: string[]): RequirementItem[] => ids.map((courseId) => ({ id: `se-${courseId}`, type: "course", courseId }));
const placeholder = (id: string, label: string, semester: number, units = 3): RequirementItem => ({ id: `se-${id}`, type: "placeholder", label, description: `${units} units; choose according to the official catalog.`, recommendedSemester: semester });
const choice = (a: string, b: string): RequirementItem[] => items(a, b).map((item) => ({ ...item, description: `Choose ONE: ${courses.find((c) => c.id === a)!.code} OR ${courses.find((c) => c.id === b)!.code} (3 units total).` }));
const requirementGroups: RequirementGroup[] = [
  { id: "se-1", title: "Year 1 - Fall (16 units)", description: "Official recommended semester 1. ENGL 1A is the recommended GE Area 1A choice.", items: [...items("se-cs46a", "ce-engr10", "ce-engl1a"), placeholder("ge1c", "GE Area 1C", 1), ...items("ce-math30")] },
  { id: "se-2", title: "Year 1 - Spring (14 units)", description: "Official recommended semester 2.", items: items("se-cs46b", "ce-engl1b", "ce-math42", "ce-phys50") },
  { id: "se-3", title: "Year 2 - Fall (16 units)", description: "Complete the Upper Division Writing Directed Self Placement.", items: [placeholder("ge5b", "GE Area 5B", 3), ...items("ce-cmpe131"), placeholder("ge3a", "GE Area 3A", 3), placeholder("ge4a", "GE Area 4 + US 1 or US 2-3", 3), ...items("ce-math31")] },
  { id: "se-4", title: "Year 2 - Spring (15 units)", description: "Official recommended semester 4.", items: [...items("se-cs146"), placeholder("ge6", "GE Area 6", 4), placeholder("ge4b", "GE Area 4 + US 1 or US 2-3", 4), ...items("ce-cmpe70", "se-cmpe165")] },
  { id: "se-5", title: "Year 3 - Fall (15 units)", description: "Official recommended semester 5.", items: [placeholder("elective1", "University elective (lower or upper division)", 5), ...items("se-cmpe120", "se-cs149", "se-cs157a", "se-cmpe187")] },
  { id: "se-6", title: "Year 3 - Spring (15 units)", description: "Apply to graduate. The two math alternatives below count as one 3-unit requirement.", items: [...items("ce-cmpe148"), placeholder("elective2", "University elective", 6), placeholder("science1", "Additional Math/Science elective", 6), ...items("ce-engr100w"), ...choice("ce-math33la", "se-math142")] },
  { id: "se-7", title: "Year 4 - Fall (16 units)", description: "Choose one probability/statistics course; do not count both alternatives toward the semester total.", items: [placeholder("science2", "Additional Math/Science elective", 7, 4), ...items("se-cmpe172"), ...choice("se-math161a", "ce-ise130"), ...items("ce-cmpe195a", "se-cs166", "ce-engr195a")] },
  { id: "se-8", title: "Year 4 - Spring (13 units)", description: "Official recommended semester 8. Minimum degree total: 120 units.", items: [...items("ce-cmpe195b", "ce-engr195b", "se-ise164"), placeholder("technical1", "Technical upper-division elective", 8), placeholder("technical2", "Technical upper-division elective", 8)] },
];
export const softwareEngineeringCatalog: ProgramCatalog = {
  ...computerEngineeringCatalog, name: "Software Engineering", abbreviation: "BSSE", dataVersion: "se-2026-2027-reviewed-1", lastVerifiedAt: "2026-09-10",
  sourceUrl, programUrl: sourceUrl, courses, requirementGroups,
};
