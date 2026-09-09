import { Availability, PrismaClient, RuleOperator } from "@prisma/client";

const prisma = new PrismaClient();

const programSources = {
  cmpe: "https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/index.php",
  se: "https://www.sjsu.edu/cmpe/undergraduate_programs/bs-software-engineering/index.php",
};
const scheduleSource = "https://www.sjsu.edu/classes/schedules/fall-2026.php";

type SeedCourse = {
  id: string;
  code: string;
  title: string;
  units: number;
  semester: number;
  prerequisites?: string[];
};

async function seedCatalog(input: {
  slug: string;
  name: string;
  abbreviation: string;
  catalogYear: string;
  semesterCount: number;
  sourceUrl: string;
  courses: SeedCourse[];
}) {
  const program = await prisma.program.upsert({
    where: { slug: input.slug },
    update: { name: input.name, abbreviation: input.abbreviation },
    create: { slug: input.slug, name: input.name, abbreviation: input.abbreviation },
  });
  const catalog = await prisma.catalogVersion.upsert({
    where: { programId_catalogYear: { programId: program.id, catalogYear: input.catalogYear } },
    update: { dataVersion: "week-1-fixture", sourceUrl: input.sourceUrl, semesterCount: input.semesterCount },
    create: {
      programId: program.id,
      catalogYear: input.catalogYear,
      dataVersion: "week-1-fixture",
      sourceUrl: input.sourceUrl,
      semesterCount: input.semesterCount,
    },
  });

  for (const item of input.courses) {
    await prisma.course.upsert({ where: { id: item.id }, update: { code: item.code }, create: { id: item.id, code: item.code } });
  }
  for (const item of input.courses) {
    const version = await prisma.courseVersion.upsert({
      where: { courseId_catalogVersionId: { courseId: item.id, catalogVersionId: catalog.id } },
      update: { title: item.title, units: item.units },
      create: {
        courseId: item.id,
        catalogVersionId: catalog.id,
        title: item.title,
        units: item.units,
        description: `${item.title}. Confirm catalog-specific details with the linked official SJSU source.`,
      },
    });
    await prisma.roadmapItem.upsert({
      where: { courseVersionId: version.id },
      update: { recommendedSemester: item.semester },
      create: { courseVersionId: version.id, recommendedSemester: item.semester },
    });
    await prisma.prerequisiteRule.deleteMany({ where: { courseVersionId: version.id } });
    if (item.prerequisites?.length) {
      await prisma.prerequisiteRule.createMany({
        data: item.prerequisites.map((requiredCourseId) => ({
          courseVersionId: version.id,
          requiredCourseId,
          groupKey: "all-required",
          operator: RuleOperator.AND,
        })),
      });
    }
  }
}

async function main() {
  await seedCatalog({
    slug: "computer-engineering",
    name: "Computer Engineering",
    abbreviation: "BSCMPE",
    catalogYear: "Fall 2024 chart",
    semesterCount: 10,
    sourceUrl: programSources.cmpe,
    courses: [
      { id: "cmpe30", code: "CMPE 30", title: "Programming Concepts and Methodology", units: 3, semester: 3 },
      { id: "cmpe50", code: "CMPE 50", title: "Data Structures and Object-Oriented Programming", units: 3, semester: 5, prerequisites: ["cmpe30"] },
      { id: "cmpe126", code: "CMPE 126", title: "Algorithms and Data Structure Design", units: 3, semester: 6, prerequisites: ["cmpe50"] },
      { id: "cmpe131", code: "CMPE 131", title: "Software Engineering I", units: 3, semester: 8, prerequisites: ["cmpe126"] },
    ],
  });
  await seedCatalog({
    slug: "software-engineering",
    name: "Software Engineering",
    abbreviation: "BSSE",
    catalogYear: "Fall 2023 chart",
    semesterCount: 8,
    sourceUrl: programSources.se,
    courses: [
      { id: "cs46a", code: "CS 46A", title: "Introduction to Programming", units: 3, semester: 1 },
      { id: "cs46b", code: "CS 46B", title: "Introduction to Data Structures", units: 3, semester: 2, prerequisites: ["cs46a"] },
      { id: "cs146", code: "CS 146", title: "Data Structures and Algorithms", units: 3, semester: 3, prerequisites: ["cs46b"] },
      { id: "cs151", code: "CS 151", title: "Object-Oriented Design", units: 3, semester: 4, prerequisites: ["cs46b"] },
      { id: "cmpe131", code: "CMPE 131", title: "Software Engineering I", units: 3, semester: 5, prerequisites: ["cs146", "cs151"] },
    ],
  });

  const term = await prisma.term.upsert({
    where: { id: "fall-2026" },
    update: { label: "Fall 2026", sourceUrl: scheduleSource, dataVersion: "week-1-fixture" },
    create: { id: "fall-2026", label: "Fall 2026", sourceUrl: scheduleSource, dataVersion: "week-1-fixture" },
  });
  const instructor = await prisma.instructor.upsert({ where: { name: "Daphne Chen" }, update: {}, create: { name: "Daphne Chen" } });
  await prisma.section.upsert({
    where: { id: "cmpe131-05" },
    update: { availability: Availability.OPEN, openSeats: null },
    create: {
      id: "cmpe131-05",
      courseId: "cmpe131",
      termId: term.id,
      instructorId: instructor.id,
      sectionNumber: "05",
      availability: Availability.OPEN,
      openSeats: null,
      sourceUrl: scheduleSource,
      meetings: { create: [{ days: ["Tue", "Thu"], startTime: "9:00 AM", endTime: "10:15 AM", location: "BBC 322" }] },
    },
  });
}

main().finally(async () => prisma.$disconnect());
