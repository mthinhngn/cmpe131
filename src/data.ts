import type { Course, Section } from "./types";

export const TERM = "Fall 2026" as const;
export const MAJOR = "Software Engineering";
export const COMPUTER_ENGINEERING = "Computer Engineering";
export const scheduleSource = "https://www.sjsu.edu/classes/schedules/fall-2026.php";
export const programSource = "https://www.sjsu.edu/cmpe/undergraduate_programs/bs-software-engineering/index.php";
export const roadmapSource = "https://www.sjsu.edu/cmpe/docs/bs-se/fall_2023_BSSE_prereq_chart.pdf";
export const computerRoadmapSource = "https://www.sjsu.edu/cmpe/docs/bs-cmpe/fall_2024_BSCMPE_prereq_chart.pdf";
export const courseListSource = "https://www.sjsu.edu/cmpe/undergraduate_programs/undergraduate_courses.php";

export const courses: Course[] = [
  { id: "cs46a", code: "CS 46A", title: "Introduction to Programming", units: 3, recommendedSemester: 1, prerequisiteCourseIds: [], description: "Foundational programming and problem-solving concepts used throughout the Software Engineering program.", sourceUrl: roadmapSource },
  { id: "math30", code: "MATH 30", title: "Calculus I", units: 3, recommendedSemester: 1, prerequisiteCourseIds: [], description: "Differential calculus foundation for the engineering mathematics sequence.", sourceUrl: roadmapSource },
  { id: "cs46b", code: "CS 46B", title: "Introduction to Data Structures", units: 3, recommendedSemester: 2, prerequisiteCourseIds: ["cs46a"], description: "Object-oriented programming and foundational data structures.", sourceUrl: roadmapSource },
  { id: "math31", code: "MATH 31", title: "Calculus II", units: 3, recommendedSemester: 2, prerequisiteCourseIds: ["math30"], description: "Integral calculus and infinite series for engineering students.", sourceUrl: roadmapSource },
  { id: "math42", code: "MATH 42", title: "Discrete Mathematics", units: 3, recommendedSemester: 2, prerequisiteCourseIds: ["math30"], description: "Logic, sets, relations, combinatorics, graphs, and discrete structures.", sourceUrl: roadmapSource },
  { id: "cs146", code: "CS 146", title: "Data Structures and Algorithms", units: 3, recommendedSemester: 3, prerequisiteCourseIds: ["cs46b", "math42"], description: "Design and analysis of efficient algorithms and advanced data structures.", sourceUrl: roadmapSource },
  { id: "cmpe120", code: "CMPE 120", title: "Computer Organization and Architecture", units: 3, recommendedSemester: 3, prerequisiteCourseIds: ["cs46b"], description: "Organization of computer systems, processors, memory, and low-level execution.", sourceUrl: courseListSource },
  { id: "cs151", code: "CS 151", title: "Object-Oriented Design", units: 3, recommendedSemester: 4, prerequisiteCourseIds: ["cs46b"], description: "Object-oriented analysis, design principles, patterns, and implementation practices.", sourceUrl: roadmapSource },
  { id: "cmpe131", code: "CMPE 131", title: "Software Engineering I", units: 3, recommendedSemester: 5, prerequisiteCourseIds: ["cs146", "cs151"], description: "Software lifecycle, requirements, architecture, teamwork, testing, and project delivery.", sourceUrl: courseListSource },
  { id: "cs149", code: "CS 149", title: "Operating Systems", units: 3, recommendedSemester: 5, prerequisiteCourseIds: ["cs146", "cmpe120"], description: "Processes, concurrency, memory, file systems, and operating system design.", sourceUrl: roadmapSource },
  { id: "cs157a", code: "CS 157A", title: "Introduction to Database Management Systems", units: 3, recommendedSemester: 5, prerequisiteCourseIds: ["cs146"], description: "Relational data modeling, SQL, database design, transactions, and implementation.", sourceUrl: roadmapSource },
  { id: "cmpe148", code: "CMPE 148", title: "Computer Networks I", units: 3, recommendedSemester: 6, prerequisiteCourseIds: ["cmpe120", "cs146"], description: "Network architecture, protocols, routing, transport, and practical network systems.", sourceUrl: courseListSource },
  { id: "cmpe165", code: "CMPE 165", title: "Software Engineering Process Management", units: 3, recommendedSemester: 6, prerequisiteCourseIds: ["cmpe131"], description: "Planning, estimation, risk, quality, and management of software engineering processes.", sourceUrl: courseListSource },
  { id: "cmpe172", code: "CMPE 172", title: "Large Scale Systems", units: 3, recommendedSemester: 6, prerequisiteCourseIds: ["cmpe131", "cs149"], description: "Architecture and operation of scalable distributed software systems.", sourceUrl: courseListSource },
  { id: "cmpe187", code: "CMPE 187", title: "Software Quality Engineering", units: 3, recommendedSemester: 7, prerequisiteCourseIds: ["cmpe131"], description: "Verification, validation, test strategy, quality models, and software reliability.", sourceUrl: courseListSource },
  { id: "cmpe195a", code: "CMPE 195A", title: "Senior Design Project I", units: 2, recommendedSemester: 7, prerequisiteCourseIds: ["cmpe165", "cmpe172"], description: "First half of the senior design sequence, including proposal, architecture, and initial implementation.", sourceUrl: roadmapSource },
  { id: "cmpe195b", code: "CMPE 195B", title: "Senior Design Project II", units: 3, recommendedSemester: 8, prerequisiteCourseIds: ["cmpe195a"], description: "Completion, validation, presentation, and delivery of the senior design project.", sourceUrl: roadmapSource },
];

const roadmapCourse = (
  id: string,
  code: string,
  title: string,
  recommendedSemester: number,
  prerequisiteCourseIds: string[] = [],
  sourceUrl = roadmapSource,
  unitsOverride?: number,
): Course => ({
  id,
  code,
  title,
  units: unitsOverride ?? (code.includes("195A") || code.includes("195B") ? 2 : 3),
  description: `${title} in the SJSU degree roadmap. Open the official chart to confirm catalog-specific requirements.`,
  recommendedSemester,
  prerequisiteCourseIds,
  sourceUrl,
});

const softwareExtras: Course[] = [
  roadmapCourse("se-engl1a", "ENGL 1A", "First-Year Writing", 1),
  roadmapCourse("se-biol10", "BIOL 10", "The Living World", 1),
  roadmapCourse("se-corege1", "CORE GE", "Core General Education", 1),
  roadmapCourse("se-engl1b", "ENGL 1B", "Argument and Analysis", 2, ["se-engl1a"]),
  roadmapCourse("se-engr10", "ENGR 10", "Introduction to Engineering", 2),
  roadmapCourse("se-math32", "MATH 32", "Calculus III", 3, ["math31"]),
  roadmapCourse("se-math33la", "MATH 33LA", "Differential Equations and Linear Algebra", 3, ["math31"]),
  roadmapCourse("se-phys50", "PHYS 50", "General Physics: Mechanics", 3, ["math30"]),
  roadmapCourse("se-cmpe102", "CMPE 102", "Assembly Language Programming", 3, ["cs46b"]),
  roadmapCourse("se-phys51", "PHYS 51", "General Physics: Electricity and Magnetism", 4, ["se-phys50", "math31"]),
  roadmapCourse("se-ise130", "ISE 130", "Engineering Probability and Statistics", 4, ["math31"]),
  roadmapCourse("se-engr100w", "ENGR 100W", "Engineering Reports", 4, ["se-engl1b"]),
  roadmapCourse("se-cs166", "CS 166", "Information Security", 5, ["cs146"]),
  roadmapCourse("se-cmpe133", "CMPE 133", "Software Engineering II", 6, ["cmpe131"]),
  roadmapCourse("se-ise164", "ISE 164", "Human-Computer Interaction", 6, ["cmpe131"]),
  roadmapCourse("se-engr195a", "ENGR 195A", "Senior Project Activity I", 7, ["se-engr100w"]),
  roadmapCourse("se-elective1", "SE ELECTIVE", "Technical Elective I", 7),
  roadmapCourse("se-engr195b", "ENGR 195B", "Senior Project Activity II", 8, ["se-engr195a"]),
  roadmapCourse("se-elective2", "SE ELECTIVE", "Technical Elective II", 8),
];

export const softwareEngineeringCourses: Course[] = [...courses, ...softwareExtras];

export const computerEngineeringCourses: Course[] = [
  roadmapCourse("ce-engr10", "ENGR 10", "Introduction to Engineering", 1, [], computerRoadmapSource),
  roadmapCourse("ce-math30", "MATH 30", "Calculus I", 1, [], computerRoadmapSource),
  roadmapCourse("ce-math42", "MATH 42", "Discrete Mathematics", 1, [], computerRoadmapSource),
  roadmapCourse("ce-engl1a", "ENGL 1A", "First-Year Writing", 2, [], computerRoadmapSource),
  roadmapCourse("ce-phys50", "PHYS 50", "General Physics: Mechanics", 2, ["ce-math30"], computerRoadmapSource, 4),
  roadmapCourse("ce-math31", "MATH 31", "Calculus II", 2, ["ce-math30"], computerRoadmapSource, 4),
  roadmapCourse("ce-engl1b", "ENGL 1B", "Argument and Analysis", 3, ["ce-engl1a"], computerRoadmapSource),
  roadmapCourse("ce-phys51", "PHYS 51", "General Physics: Electricity and Magnetism", 3, ["ce-phys50", "ce-math31"], computerRoadmapSource, 4),
  roadmapCourse("ce-cmpe30", "CMPE 30", "Programming Concepts and Methodology", 3, ["ce-math30", "ce-engr10"], computerRoadmapSource),
  roadmapCourse("ce-math32", "MATH 32", "Calculus III", 3, ["ce-math31"], computerRoadmapSource),
  roadmapCourse("ce-ee97", "EE 97", "Introductory Electrical Engineering Laboratory", 4, ["ce-ee98"], computerRoadmapSource, 1),
  roadmapCourse("ce-ee98", "EE 98", "Introduction to Circuit Analysis", 4, ["ce-phys51"], computerRoadmapSource),
  roadmapCourse("ce-math33la", "MATH 33LA", "Differential Equations and Linear Algebra", 4, ["ce-math31"], computerRoadmapSource),
  roadmapCourse("ce-biol10", "BIOL 10", "The Living World", 4, [], computerRoadmapSource),
  roadmapCourse("ce-cmpe50", "CMPE 50", "Data Structures and Object-Oriented Programming", 5, ["ce-cmpe30"], computerRoadmapSource),
  roadmapCourse("ce-ise130", "ISE 130", "Engineering Probability and Statistics", 6, ["ce-math32"], computerRoadmapSource),
  roadmapCourse("ce-cmpe126", "CMPE 126", "Algorithms and Data Structure Design", 6, ["ce-cmpe50", "ce-math42"], computerRoadmapSource),
  roadmapCourse("ce-cmpe110", "CMPE 110", "Electronics for Computing Systems", 6, ["ce-ee98"], computerRoadmapSource),
  roadmapCourse("ce-cmpe124", "CMPE 124", "Digital Design I", 6, ["ce-ee97", "ce-ee98"], computerRoadmapSource),
  roadmapCourse("ce-engr100w", "ENGR 100W", "Engineering Reports", 7, ["ce-engl1b"], computerRoadmapSource),
  roadmapCourse("ce-cmpe125", "CMPE 125", "Digital Design II", 7, ["ce-cmpe124"], computerRoadmapSource),
  roadmapCourse("ce-cmpe127", "CMPE 127", "Microprocessor Design I", 7, ["ce-cmpe124"], computerRoadmapSource),
  roadmapCourse("ce-cmpe102", "CMPE 102", "Assembly Language Programming", 7, ["ce-cmpe50"], computerRoadmapSource),
  roadmapCourse("ce-cmpe148", "CMPE 148", "Computer Networks I", 8, ["ce-cmpe50", "ce-cmpe124"], computerRoadmapSource),
  roadmapCourse("ce-cmpe130", "CMPE 130", "Advanced Algorithm Design", 8, ["ce-cmpe126"], computerRoadmapSource),
  roadmapCourse("ce-cmpe131", "CMPE 131", "Software Engineering I", 8, ["ce-cmpe126"], computerRoadmapSource),
  roadmapCourse("ce-cmpe142", "CMPE 142", "Operating Systems Design", 8, ["ce-cmpe124", "ce-cmpe126", "ce-engr100w"], computerRoadmapSource),
  roadmapCourse("ce-cmpe152", "CMPE 152", "Compiler Design", 9, ["ce-cmpe102", "ce-cmpe126"], computerRoadmapSource),
  roadmapCourse("ce-cmpe146", "CMPE 146", "Real-Time Embedded System Co-Design", 9, ["ce-cmpe127"], computerRoadmapSource),
  roadmapCourse("ce-engr195a", "ENGR 195A", "Senior Project Activity I", 9, ["ce-engr100w"], computerRoadmapSource, 1),
  roadmapCourse("ce-cmpe195a", "CMPE 195A", "Senior Design Project I", 9, ["ce-cmpe125", "ce-cmpe127", "ce-cmpe130", "ce-cmpe131", "ce-engr100w"], computerRoadmapSource),
  roadmapCourse("ce-cmpe140", "CMPE 140", "Computer Architecture and Design", 9, ["ce-cmpe125", "ce-engr100w"], computerRoadmapSource),
  roadmapCourse("ce-cmpe195b", "CMPE 195B", "Senior Design Project II", 10, ["ce-cmpe195a"], computerRoadmapSource, 3),
  roadmapCourse("ce-engr195b", "ENGR 195B", "Senior Project Activity II", 10, ["ce-engr195a"], computerRoadmapSource, 1),
  roadmapCourse("ce-elective1", "CMPE ELECTIVE", "Technical Elective I", 10, [], computerRoadmapSource),
  roadmapCourse("ce-elective2", "CMPE ELECTIVE", "Technical Elective II", 10, [], computerRoadmapSource),
  roadmapCourse("ce-elective3", "CMPE ELECTIVE", "Technical Elective III", 10, [], computerRoadmapSource),
];

export const roadmaps = {
  [MAJOR]: {
    name: MAJOR,
    abbreviation: "BSSE",
    catalog: "Fall 2023 chart",
    sourceNote: "Official SJSU BSSE prerequisite chart sequence.",
    sourceUrl: roadmapSource,
    programUrl: programSource,
    semesterCount: 8,
    courses: softwareEngineeringCourses,
  },
  [COMPUTER_ENGINEERING]: {
    name: COMPUTER_ENGINEERING,
    abbreviation: "BSCMPE",
    catalog: "Current SJSU chart · Fall 2024 catalog",
    sourceNote: "Official BSCMPE sequence. CMPE 131 is a required Computer Engineering course on this chart; no CS courses are included.",
    sourceUrl: computerRoadmapSource,
    programUrl: "https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/index.php",
    semesterCount: 10,
    courses: computerEngineeringCourses,
  },
} as const;

export type MajorName = keyof typeof roadmaps;
export const majors = Object.keys(roadmaps) as MajorName[];

export const allCourseById = new Map(
  [...softwareEngineeringCourses, ...computerEngineeringCourses].map((course) => [course.id, course]),
);

const meeting = (days: string[], startTime: string, endTime: string, location: string) => [{ days, startTime, endTime, location }];

export const sections: Section[] = [
  { id: "cmpe120-01", courseId: "cmpe120", term: TERM, sectionNumber: "01", instructor: "Olivia Weng", meetings: meeting(["Tue", "Thu"], "10:30 AM", "11:45 AM", "ENG 325"), availability: "open", openSeats: 10, sourceUrl: scheduleSource },
  { id: "cmpe120-02", courseId: "cmpe120", term: TERM, sectionNumber: "02", instructor: "Olivia Weng", meetings: meeting(["Tue", "Thu"], "1:30 PM", "2:45 PM", "ENG 325"), availability: "open", openSeats: 9, sourceUrl: scheduleSource },
  { id: "cs146-03", courseId: "cs146", term: TERM, sectionNumber: "03", instructor: "Kostas Tsioutsiouliklis", meetings: meeting(["Mon", "Wed"], "9:00 AM", "10:15 AM", "DH 450"), availability: "open", openSeats: 15, sourceUrl: scheduleSource },
  { id: "cs146-04", courseId: "cs146", term: TERM, sectionNumber: "04", instructor: "Muniba Shaikh", meetings: meeting(["Mon", "Wed"], "10:30 AM", "11:45 AM", "DH 450"), availability: "open", openSeats: 8, sourceUrl: scheduleSource },
  { id: "cmpe131-04", courseId: "cmpe131", term: TERM, sectionNumber: "04", instructor: "Ishie Eswar", meetings: meeting(["Wed"], "6:00 PM", "8:45 PM", "CL 324"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cmpe131-05", courseId: "cmpe131", term: TERM, sectionNumber: "05", instructor: "Daphne Chen", meetings: meeting(["Tue", "Thu"], "9:00 AM", "10:15 AM", "BBC 322"), availability: "open", openSeats: 1, sourceUrl: scheduleSource },
  { id: "cmpe131-07", courseId: "cmpe131", term: TERM, sectionNumber: "07", instructor: "Ishie Eswar", meetings: meeting(["Mon"], "6:00 PM", "8:45 PM", "ENG 337"), availability: "open", openSeats: 2, sourceUrl: scheduleSource },
  { id: "cs149-02", courseId: "cs149", term: TERM, sectionNumber: "02", instructor: "Frank Butt", meetings: meeting(["Mon", "Wed"], "4:30 PM", "5:45 PM", "DH 450"), availability: "open", openSeats: 11, sourceUrl: scheduleSource },
  { id: "cs149-03", courseId: "cs149", term: TERM, sectionNumber: "03", instructor: "Faramarz Mortezaie", meetings: meeting(["Mon", "Wed"], "9:00 AM", "10:15 AM", "MH 224"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cs157a-01", courseId: "cs157a", term: TERM, sectionNumber: "01", instructor: "Ching-Seh Wu", meetings: meeting(["Tue", "Thu"], "3:00 PM", "4:15 PM", "DH 415"), availability: "open", openSeats: 1, sourceUrl: scheduleSource },
  { id: "cs157a-03", courseId: "cs157a", term: TERM, sectionNumber: "03", instructor: "Tahereh Arabghalizi", meetings: meeting(["Mon", "Wed"], "3:00 PM", "4:15 PM", "SH 435"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cmpe148-02", courseId: "cmpe148", term: TERM, sectionNumber: "02", instructor: "Balaji Venkatraman", meetings: meeting(["Mon", "Wed"], "7:30 AM", "8:45 AM", "ENG 325"), availability: "open", openSeats: 1, sourceUrl: scheduleSource },
  { id: "cmpe148-04", courseId: "cmpe148", term: TERM, sectionNumber: "04", instructor: "Juan Gomez", meetings: meeting(["Thu"], "6:00 PM", "8:45 PM", "CL 204"), availability: "open", openSeats: 7, sourceUrl: scheduleSource },
  { id: "cmpe165-01", courseId: "cmpe165", term: TERM, sectionNumber: "01", instructor: "Hsin-Yi Meng", meetings: meeting(["Mon", "Wed"], "12:00 PM", "1:15 PM", "ENG 337"), availability: "open", openSeats: 1, sourceUrl: scheduleSource },
  { id: "cmpe165-03", courseId: "cmpe165", term: TERM, sectionNumber: "03", instructor: "Dhruba Borthakur", meetings: meeting(["Tue", "Thu"], "7:30 AM", "8:45 AM", "ENG 339"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cmpe172-01", courseId: "cmpe172", term: TERM, sectionNumber: "01", instructor: "Gopinath Vinodh", meetings: meeting(["Mon", "Wed"], "3:00 PM", "4:15 PM", "SCI 253"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cmpe172-02", courseId: "cmpe172", term: TERM, sectionNumber: "02", instructor: "Balaji Venkatraman", meetings: meeting(["Tue", "Thu"], "7:30 AM", "8:45 AM", "ENG 329"), availability: "open", openSeats: 13, sourceUrl: scheduleSource },
  { id: "cmpe187-02", courseId: "cmpe187", term: TERM, sectionNumber: "02", instructor: "Radhika Agarwal", meetings: meeting(["Tue", "Thu"], "3:00 PM", "4:15 PM", "BBC 226"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
  { id: "cmpe187-03", courseId: "cmpe187", term: TERM, sectionNumber: "03", instructor: "Radhika Agarwal", meetings: meeting(["Tue", "Thu"], "4:30 PM", "5:45 PM", "BBC 226"), availability: "closed", openSeats: 0, sourceUrl: scheduleSource },
];

export const courseById = new Map(courses.map((course) => [course.id, course]));

export function getCourseSections(courseId: string) {
  const direct = sections.filter((section) => section.courseId === courseId);
  if (direct.length) return direct;
  const courseCode = allCourseById.get(courseId)?.code;
  const matchingBaseCourse = courses.find((course) => course.code === courseCode);
  return matchingBaseCourse ? sections.filter((section) => section.courseId === matchingBaseCourse.id) : [];
}
