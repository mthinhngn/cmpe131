import type { Course, ProgramCatalog, RequirementGroup } from "./types";
import { FALL_2026_FETCHED_AT, FALL_2026_SCHEDULE_SOURCE, fall2026Offerings } from "./fall2026Offerings.generated";

export const PROGRAM_SOURCE = "https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19250&returnto=8647";
export const ROADMAP_SOURCE = PROGRAM_SOURCE;

const course = (
  id: string,
  code: string,
  title: string,
  units: number,
  recommendedSemester: number,
  coid: string,
  prerequisiteCourseIds: string[] = [],
  prerequisiteText?: string,
  corequisiteCourseIds: string[] = [],
): Course => ({
  id, code, title, units, recommendedSemester, prerequisiteCourseIds, corequisiteCourseIds, prerequisiteText,
  description: `${title} in the official SJSU Computer Engineering 2026-2027 roadmap.`,
  sourceUrl: `https://catalog.sjsu.edu/preview_course_nopop.php?catoid=23&coid=${coid}`,
});

export const computerEngineeringCourses: Course[] = [
  course("ce-cmpe30", "CMPE 30", "Programming Concepts and Methodology", 4, 1, "198815"),
  course("ce-engr10", "ENGR 10", "Introduction to Engineering", 3, 1, "199563", [], "Math/writing placement or the catalog-listed equivalent; Engineering majors only."),
  course("ce-engl1a", "ENGL 1A", "First Year Writing", 3, 1, "197611", [], "Writing placement category requirement. Recommended roadmap choice for GE Area 1A."),
  course("ce-math30", "MATH 30", "Calculus I", 3, 1, "198077", [], "Math placement/proficiency requirement or the catalog-listed MATH 18A/18B or MATH 19 pathway."),
  course("ce-cmpe50", "CMPE 50", "Intro to Data Structures and Object-Oriented Programming", 4, 2, "198814", ["ce-cmpe30"], "CMPE 30 with a minimum grade of C-."),
  course("ce-engl1b", "ENGL 1B", "Argument and Analysis", 3, 2, "198582", ["ce-engl1a"], "ENGL 1A or ENGL 1AS with a grade of C- or better."),
  course("ce-math31", "MATH 31", "Calculus II", 4, 2, "198088", ["ce-math30"], "AP Calculus pathway or MATH 30 with a grade of C- or better."),
  course("ce-phys50", "PHYS 50", "General Physics I: Mechanics", 4, 2, "197802", ["ce-math30"], "Writing eligibility and AP Calculus score of 3+ or MATH 30/30X with a grade of C- or better; Science or Engineering majors."),
  course("ce-math32", "MATH 32", "Calculus III", 3, 3, "198113", ["ce-math31"], "AP Calculus BC pathway or MATH 31; MATH 32W may be a corequisite depending on grade/placement."),
  course("ce-biol10", "BIOL 10", "The Living World", 3, 3, "197902", [], "No course prerequisite listed. Recommended roadmap choice for GE Area 5B."),
  course("ce-math42", "MATH 42", "Discrete Mathematics", 3, 3, "200890", [], "Math placement/proficiency requirement or the catalog-listed AP/MATH 18A/18B/MATH 19 pathway."),
  course("ce-phys51", "PHYS 51", "General Physics II: Electricity and Magnetism", 4, 3, "197814", ["ce-phys50", "ce-math31"], "PHYS 50 and MATH 31, both with grades of C- or better; Science or Engineering majors."),
  course("ce-cmpe70", "CMPE 70", "Assembly Language Programming", 3, 4, "198753", ["ce-cmpe50"], "CMPE 50 or CS 46B with a grade of C- or better; CMPE or SE majors."),
  course("ce-ee97", "EE 97", "Introductory Electrical Engineering Laboratory", 1, 4, "199452", [], "Engineering majors only. EE 98 is a corequisite.", ["ce-ee98"]),
  course("ce-ee98", "EE 98", "Introduction to Circuit Analysis", 3, 4, "199453", ["ce-phys51"], "PHYS 51 with a grade of C- or better; Engineering majors. MATH 33A or MATH 33LA is a corequisite.", ["ce-math33la"]),
  course("ce-math33la", "MATH 33LA", "Differential Equations and Linear Algebra", 3, 4, "202695", ["ce-math31"], "MATH 31 with a grade of C- or better, or instructor consent."),
  course("ce-cmpe125", "CMPE 125", "Digital Design", 4, 5, "198756", ["ce-cmpe70"], "CMPE 70 with a grade of C- or better; CMPE or SE majors."),
  course("ce-cmpe126", "CMPE 126", "Algorithms and Data Structure Design", 3, 5, "198757", ["ce-cmpe50", "ce-math42"], "CMPE 50 and MATH 42, both with grades of C- or better; CMPE or SE majors."),
  course("ce-engr100w", "ENGR 100W", "Engineering Reports", 3, 5, "202587", ["ce-engl1b"], "ENGL 1B or equivalent with a grade of C- or better, completion of core GE, and upper-division standing."),
  course("ce-cmpe110", "CMPE 110", "Electronics for Computing Systems", 4, 6, "198801", ["ce-ee97", "ce-ee98", "ce-math33la"], "EE 97, EE 98, and MATH 33LA (or the catalog-listed alternative), all with grades of C- or better."),
  course("ce-cmpe127", "CMPE 127", "Microprocessor Design I", 3, 6, "198758", ["ce-cmpe125"], "CMPE 125 with a grade of C- or better; CMPE or SE majors."),
  course("ce-cmpe131", "CMPE 131", "Software Engineering I", 3, 6, "198760", ["ce-cmpe50"], "CMPE 50 or CS 46B with a grade of C- or better."),
  course("ce-cmpe142", "CMPE 142", "Operating Systems Design", 3, 6, "198766", ["ce-cmpe70", "ce-cmpe126"], "CMPE 70 and CMPE 126 with grades of C- or better; CMPE 130 is a pre/corequisite in the course catalog."),
  course("ce-cmpe140", "CMPE 140", "Computer Architecture and Design", 3, 7, "198765", ["ce-cmpe125"], "CMPE 125 with a grade of C- or better; CMPE or SE majors."),
  course("ce-cmpe146", "CMPE 146", "Real-Time Embedded System Co-Design", 3, 7, "198767", ["ce-cmpe70", "ce-cmpe110", "ce-cmpe127"], "CMPE 70, CMPE 110, and CMPE 127 with grades of C- or better; CMPE or SE majors."),
  course("ce-cmpe195a", "CMPE 195A", "Senior Design Project I", 2, 7, "200883", ["ce-cmpe125", "ce-cmpe131", "ce-engr100w"], "For CMPE majors: CMPE 125 and CMPE 131 with C- or better; ENGR 100W with C or better; upper-division/GE/standing and graduation-application requirements.", ["ce-engr195a"]),
  course("ce-engr195a", "ENGR 195A", "Global and Social Issues in Engineering", 1, 7, "200913", ["ce-engr100w"], "ENGR 100W with a grade of C or better, core GE, upper-division standing, and Engineering major. Major capstone is a corequisite.", ["ce-cmpe195a"]),
  course("ce-cmpe148", "CMPE 148", "Computer Networks I", 3, 8, "198768", ["ce-cmpe70", "ce-cmpe126"], "For CMPE majors: CMPE 70 and CMPE 126 with grades of C- or better."),
  course("ce-cmpe195b", "CMPE 195B", "Senior Design Project II", 3, 8, "201828", ["ce-cmpe195a"], "CMPE 195A with a grade of C or better. ENGR 195B is a corequisite.", ["ce-engr195b"]),
  course("ce-engr195b", "ENGR 195B", "Global and Social Issues in Engineering", 1, 8, "201894", ["ce-engr195a"], "ENGR 195A with a grade of C or better, core GE, upper-division standing, and Engineering major. Major capstone is a corequisite.", ["ce-cmpe195b"]),
  course("ce-ise130", "ISE 130", "Engineering Probability and Statistics", 3, 8, "200361", ["ce-math32"], "MATH 32; Engineering majors and graduate students."),
];

const items = (ids: string[]) => ids.map((courseId) => ({ id: `requirement-${courseId}`, type: "course" as const, courseId }));
const placeholder = (id: string, label: string, description: string, recommendedSemester: number) => ({ id, type: "placeholder" as const, label, description, recommendedSemester });

export const requirementGroups: RequirementGroup[] = [
  { id: "year-1-fall", title: "Year 1 - Fall (16 units)", description: "Official recommended semester 1.", items: [...items(["ce-cmpe30", "ce-engr10", "ce-engl1a"]), placeholder("ge-1c", "GE Area 1C", "3 units; may be taken in another semester.", 1), ...items(["ce-math30"])] },
  { id: "year-1-spring", title: "Year 1 - Spring (15 units)", description: "Official recommended semester 2.", items: items(["ce-cmpe50", "ce-engl1b", "ce-math31", "ce-phys50"]) },
  { id: "year-2-fall", title: "Year 2 - Fall (16 units)", description: "Complete the Upper Division Writing Directed Self Placement during this term.", items: [...items(["ce-math32"]), placeholder("ge-4-us-a", "GE Area 4 + US 1 or US 2-3", "3 units; may be taken in another semester.", 3), ...items(["ce-biol10", "ce-math42", "ce-phys51"])] },
  { id: "year-2-spring", title: "Year 2 - Spring (13 units)", description: "Official recommended semester 4.", items: [...items(["ce-cmpe70", "ce-ee97", "ce-ee98"]), placeholder("ge-4-us-b", "GE Area 4 + US 1 or US 2-3", "3 units; may be taken in another semester.", 4), ...items(["ce-math33la"])] },
  { id: "year-3-fall", title: "Year 3 - Fall (16 units)", description: "Official recommended semester 5.", items: [...items(["ce-cmpe125", "ce-cmpe126", "ce-engr100w"]), placeholder("ge-3a", "GE Area 3A", "3 units; may be taken in another semester.", 5), placeholder("university-elective-a", "University elective", "3 lower- or upper-division units; may be taken in another semester.", 5)] },
  { id: "year-3-spring", title: "Year 3 - Spring (16 units)", description: "Apply to graduate during this term.", items: [...items(["ce-cmpe110", "ce-cmpe127", "ce-cmpe131", "ce-cmpe142"]), placeholder("ge-6", "GE Area 6", "3 units; may be taken in another semester.", 6)] },
  { id: "year-4-fall", title: "Year 4 - Fall (15 units)", description: "Official recommended semester 7.", items: [...items(["ce-cmpe140", "ce-cmpe146", "ce-cmpe195a", "ce-engr195a"]), placeholder("technical-elective-a", "Technical upper-division elective", "3 units from the catalog-approved choices.", 7), placeholder("university-elective-b", "University elective", "3 lower- or upper-division units; may be taken in another semester.", 7)] },
  { id: "year-4-spring", title: "Year 4 - Spring (13 units)", description: "Official recommended semester 8.", items: [...items(["ce-cmpe148", "ce-cmpe195b", "ce-engr195b", "ce-ise130"]), placeholder("technical-elective-b", "Technical upper-division elective", "3 units from the catalog-approved choices.", 8)] },
];

export const computerEngineeringCatalog: ProgramCatalog = {
  name: "Computer Engineering", abbreviation: "BSCMPE", catalogYear: "2026-2027",
  dataVersion: "cmpe-2026-2027-reviewed-1", dataStatus: "reviewed", lastVerifiedAt: "2026-09-09",
  sourceUrl: ROADMAP_SOURCE, programUrl: PROGRAM_SOURCE, courses: computerEngineeringCourses, requirementGroups,
  currentTerm: { id: "fall-2026", name: "Fall 2026", sourceUrl: FALL_2026_SCHEDULE_SOURCE, fetchedAt: FALL_2026_FETCHED_AT },
  offerings: fall2026Offerings,
};

export const courseById = new Map(computerEngineeringCourses.map((item) => [item.id, item]));
