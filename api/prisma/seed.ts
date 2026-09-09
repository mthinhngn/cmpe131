import { Availability, PrismaClient, RuleOperator } from "@prisma/client";
import { majors, roadmaps, sections } from "../../src/data";

const prisma = new PrismaClient();

const slugByMajor = {
  "Software Engineering": "software-engineering",
  "Computer Engineering": "computer-engineering",
} as const;

async function main() {
  await prisma.$transaction([
    prisma.meeting.deleteMany(),
    prisma.section.deleteMany(),
    prisma.instructor.deleteMany(),
    prisma.term.deleteMany(),
    prisma.prerequisiteRule.deleteMany(),
    prisma.roadmapItem.deleteMany(),
    prisma.courseVersion.deleteMany(),
    prisma.sourceSnapshot.deleteMany(),
    prisma.catalogVersion.deleteMany(),
    prisma.program.deleteMany(),
    prisma.course.deleteMany(),
  ]);

  const uniqueCourses = new Map(majors.flatMap((major) => roadmaps[major].courses).map((course) => [course.id, course]));
  await prisma.course.createMany({ data: [...uniqueCourses.values()].map((course) => ({ id: course.id, code: course.code })) });

  for (const major of majors) {
    const roadmap = roadmaps[major];
    const program = await prisma.program.create({ data: { slug: slugByMajor[major], name: roadmap.name, abbreviation: roadmap.abbreviation } });
    const catalog = await prisma.catalogVersion.create({
      data: {
        programId: program.id,
        catalogYear: roadmap.catalog,
        dataVersion: "week-1-fixture",
        sourceUrl: roadmap.sourceUrl,
        semesterCount: roadmap.semesterCount,
      },
    });
    for (const course of roadmap.courses) {
      const version = await prisma.courseVersion.create({
        data: {
          courseId: course.id,
          catalogVersionId: catalog.id,
          title: course.title,
          description: course.description,
          units: course.units,
          roadmapItem: { create: { recommendedSemester: course.recommendedSemester } },
        },
      });
      if (course.prerequisiteCourseIds.length) {
        await prisma.prerequisiteRule.createMany({
          data: course.prerequisiteCourseIds.map((requiredCourseId) => ({
            courseVersionId: version.id,
            requiredCourseId,
            groupKey: "all-required",
            operator: RuleOperator.AND,
          })),
        });
      }
    }
  }

  const term = await prisma.term.create({
    data: {
      id: "fall-2026",
      label: "Fall 2026",
      sourceUrl: sections[0]?.sourceUrl ?? "https://www.sjsu.edu/classes/schedules/",
      dataVersion: "week-1-fixture",
    },
  });
  for (const section of sections) {
    const instructor = section.instructor
      ? await prisma.instructor.upsert({ where: { name: section.instructor }, update: {}, create: { name: section.instructor } })
      : null;
    await prisma.section.create({
      data: {
        id: section.id,
        courseId: section.courseId,
        termId: term.id,
        instructorId: instructor?.id,
        sectionNumber: section.sectionNumber,
        availability: section.availability.toUpperCase() as Availability,
        openSeats: section.openSeats,
        sourceUrl: section.sourceUrl,
        meetings: { create: section.meetings.map((meeting) => ({ ...meeting })) },
      },
    });
  }
}

main().finally(async () => prisma.$disconnect());
