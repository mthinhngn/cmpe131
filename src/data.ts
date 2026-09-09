import type { Course, ProgramCatalog, RequirementGroup } from "./types";

export const PROGRAM_SOURCE = "https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/index.php";
export const ROADMAP_SOURCE = "https://www.sjsu.edu/cmpe/docs/bs-cmpe/fall_2024_BSCMPE_prereq_chart.pdf";

const course = (
  id: string,
  code: string,
  title: string,
  units: number,
  recommendedSemester: number,
  prerequisiteCourseIds: string[] = [],
): Course => ({
  id,
  code,
  title,
  units,
  recommendedSemester,
  prerequisiteCourseIds,
  description: `${title} in the draft Computer Engineering graduation-requirement dataset. Confirm catalog-specific wording with the official SJSU source.`,
  sourceUrl: ROADMAP_SOURCE,
});

export const computerEngineeringCourses: Course[] = [
  course("ce-engr10", "ENGR 10", "Introduction to Engineering", 3, 1),
  course("ce-math30", "MATH 30", "Calculus I", 3, 1),
  course("ce-math42", "MATH 42", "Discrete Mathematics", 3, 1),
  course("ce-engl1a", "ENGL 1A", "First-Year Writing", 3, 2),
  course("ce-phys50", "PHYS 50", "General Physics: Mechanics", 4, 2, ["ce-math30"]),
  course("ce-math31", "MATH 31", "Calculus II", 4, 2, ["ce-math30"]),
  course("ce-engl1b", "ENGL 1B", "Argument and Analysis", 3, 3, ["ce-engl1a"]),
  course("ce-phys51", "PHYS 51", "General Physics: Electricity and Magnetism", 4, 3, ["ce-phys50", "ce-math31"]),
  course("ce-cmpe30", "CMPE 30", "Programming Concepts and Methodology", 3, 3, ["ce-math30", "ce-engr10"]),
  course("ce-math32", "MATH 32", "Calculus III", 3, 3, ["ce-math31"]),
  course("ce-ee97", "EE 97", "Introductory Electrical Engineering Laboratory", 1, 4, ["ce-ee98"]),
  course("ce-ee98", "EE 98", "Introduction to Circuit Analysis", 3, 4, ["ce-phys51"]),
  course("ce-math33la", "MATH 33LA", "Differential Equations and Linear Algebra", 3, 4, ["ce-math31"]),
  course("ce-biol10", "BIOL 10", "The Living World", 3, 4),
  course("ce-cmpe50", "CMPE 50", "Data Structures and Object-Oriented Programming", 3, 5, ["ce-cmpe30"]),
  course("ce-ise130", "ISE 130", "Engineering Probability and Statistics", 3, 6, ["ce-math32"]),
  course("ce-cmpe126", "CMPE 126", "Algorithms and Data Structure Design", 3, 6, ["ce-cmpe50", "ce-math42"]),
  course("ce-cmpe110", "CMPE 110", "Electronics for Computing Systems", 3, 6, ["ce-ee98"]),
  course("ce-cmpe124", "CMPE 124", "Digital Design I", 3, 6, ["ce-ee97", "ce-ee98"]),
  course("ce-engr100w", "ENGR 100W", "Engineering Reports", 3, 7, ["ce-engl1b"]),
  course("ce-cmpe125", "CMPE 125", "Digital Design II", 3, 7, ["ce-cmpe124"]),
  course("ce-cmpe127", "CMPE 127", "Microprocessor Design I", 3, 7, ["ce-cmpe124"]),
  course("ce-cmpe102", "CMPE 102", "Assembly Language Programming", 3, 7, ["ce-cmpe50"]),
  course("ce-cmpe148", "CMPE 148", "Computer Networks I", 3, 8, ["ce-cmpe50", "ce-cmpe124"]),
  course("ce-cmpe130", "CMPE 130", "Advanced Algorithm Design", 3, 8, ["ce-cmpe126"]),
  course("ce-cmpe131", "CMPE 131", "Software Engineering I", 3, 8, ["ce-cmpe126"]),
  course("ce-cmpe142", "CMPE 142", "Operating Systems Design", 3, 8, ["ce-cmpe124", "ce-cmpe126", "ce-engr100w"]),
  course("ce-cmpe152", "CMPE 152", "Compiler Design", 3, 9, ["ce-cmpe102", "ce-cmpe126"]),
  course("ce-cmpe146", "CMPE 146", "Real-Time Embedded System Co-Design", 3, 9, ["ce-cmpe127"]),
  course("ce-engr195a", "ENGR 195A", "Senior Project Activity I", 1, 9, ["ce-engr100w"]),
  course("ce-cmpe195a", "CMPE 195A", "Senior Design Project I", 2, 9, ["ce-cmpe125", "ce-cmpe127", "ce-cmpe130", "ce-cmpe131", "ce-engr100w"]),
  course("ce-cmpe140", "CMPE 140", "Computer Architecture and Design", 3, 9, ["ce-cmpe125", "ce-engr100w"]),
  course("ce-cmpe195b", "CMPE 195B", "Senior Design Project II", 3, 10, ["ce-cmpe195a"]),
  course("ce-engr195b", "ENGR 195B", "Senior Project Activity II", 1, 10, ["ce-engr195a"]),
];

const items = (ids: string[]) => ids.map((courseId) => ({ id: `requirement-${courseId}`, type: "course" as const, courseId }));

export const requirementGroups: RequirementGroup[] = [
  {
    id: "university-writing-ge",
    title: "University, writing, and general education",
    description: "University-level requirements represented in the draft roadmap. The exact GE pattern still requires catalog review.",
    items: [
      ...items(["ce-engr10", "ce-engl1a", "ce-engl1b", "ce-biol10", "ce-engr100w"]),
      { id: "remaining-ge", type: "placeholder", label: "Remaining SJSU GE and university requirements", description: "Placeholder until the selected catalog is reviewed against the official degree requirements." },
    ],
  },
  {
    id: "math-science",
    title: "Mathematics and science foundation",
    description: "Required supporting mathematics, probability, physics, and science courses.",
    items: items(["ce-math30", "ce-math31", "ce-math32", "ce-math33la", "ce-math42", "ce-ise130", "ce-phys50", "ce-phys51"]),
  },
  {
    id: "lower-division-major",
    title: "Lower-division engineering core",
    description: "Programming, circuits, laboratory, and data-structure foundations for upper-division CMPE work.",
    items: items(["ce-cmpe30", "ce-cmpe50", "ce-ee97", "ce-ee98"]),
  },
  {
    id: "upper-division-major",
    title: "Upper-division Computer Engineering core",
    description: "Required Computer Engineering design, systems, hardware, software, and senior-project sequence.",
    items: items(["ce-cmpe102", "ce-cmpe110", "ce-cmpe124", "ce-cmpe125", "ce-cmpe126", "ce-cmpe127", "ce-cmpe130", "ce-cmpe131", "ce-cmpe140", "ce-cmpe142", "ce-cmpe146", "ce-cmpe148", "ce-cmpe152", "ce-engr195a", "ce-cmpe195a", "ce-engr195b", "ce-cmpe195b"]),
  },
  {
    id: "technical-electives",
    title: "Technical electives",
    description: "The exact approved elective list and unit requirement must be confirmed for the selected catalog.",
    items: [
      { id: "technical-elective-requirement", type: "placeholder", label: "Computer Engineering technical electives", description: "Choose from the catalog-approved elective list after source review." },
    ],
  },
];

export const computerEngineeringCatalog: ProgramCatalog = {
  name: "Computer Engineering",
  abbreviation: "BSCMPE",
  catalogYear: "Fall 2024 chart",
  dataVersion: "cmpe-fall-2024-draft-1",
  dataStatus: "draft-unverified",
  sourceUrl: ROADMAP_SOURCE,
  programUrl: PROGRAM_SOURCE,
  courses: computerEngineeringCourses,
  requirementGroups,
};

export const courseById = new Map(computerEngineeringCourses.map((item) => [item.id, item]));
