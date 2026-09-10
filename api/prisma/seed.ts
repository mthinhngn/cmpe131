import { PrismaClient, RequirementItemType, RuleOperator } from "@prisma/client";
import { computerEngineeringCatalog } from "../../src/data";
import { softwareEngineeringCatalog } from "../../src/softwareEngineeringData";
import { FALL_2026_FETCHED_AT, FALL_2026_SCHEDULE_SOURCE, fall2026Offerings } from "../../src/fall2026Offerings.generated";

const prisma = new PrismaClient();

async function main() {
  const catalogs = [computerEngineeringCatalog, softwareEngineeringCatalog];
  for (const catalog of catalogs) {
  const slug = catalog.abbreviation === "BSSE" ? "software-engineering" : "computer-engineering";
  const program = await prisma.program.upsert({
    where: { slug },
    update: { name: catalog.name, abbreviation: catalog.abbreviation },
    create: { slug, name: catalog.name, abbreviation: catalog.abbreviation },
  });
  const catalogVersion = await prisma.catalogVersion.upsert({
    where: { programId_catalogYear: { programId: program.id, catalogYear: catalog.catalogYear } },
    update: { dataVersion: catalog.dataVersion, sourceUrl: catalog.sourceUrl, lastVerifiedAt: new Date(catalog.lastVerifiedAt), semesterCount: 8 },
    create: {
      programId: program.id,
      catalogYear: catalog.catalogYear,
      dataVersion: catalog.dataVersion,
      sourceUrl: catalog.sourceUrl,
      lastVerifiedAt: new Date(catalog.lastVerifiedAt),
      semesterCount: 8,
    },
  });

  const versionIdByCourseId = new Map<string, string>();
  for (const item of catalog.courses) {
    await prisma.course.upsert({ where: { id: item.id }, update: { code: item.code }, create: { id: item.id, code: item.code } });
    const version = await prisma.courseVersion.upsert({
      where: { courseId_catalogVersionId: { courseId: item.id, catalogVersionId: catalogVersion.id } },
      update: { title: item.title, description: item.description, prerequisiteText: item.prerequisiteText, units: item.units },
      create: { courseId: item.id, catalogVersionId: catalogVersion.id, title: item.title, description: item.description, prerequisiteText: item.prerequisiteText, units: item.units },
    });
    versionIdByCourseId.set(item.id, version.id);
  }

  await prisma.prerequisiteRule.deleteMany({ where: { courseVersion: { catalogVersionId: catalogVersion.id } } });
  for (const item of catalog.courses) {
    const courseVersionId = versionIdByCourseId.get(item.id)!;
    if (item.prerequisiteCourseIds.length) {
      await prisma.prerequisiteRule.createMany({
        data: item.prerequisiteCourseIds.map((requiredCourseId) => ({
          courseVersionId,
          requiredCourseId,
          groupKey: "all-required",
          operator: RuleOperator.AND,
        })),
      });
    }
    if (item.corequisiteCourseIds.length) {
      await prisma.prerequisiteRule.createMany({
        data: item.corequisiteCourseIds.map((requiredCourseId) => ({
          courseVersionId,
          requiredCourseId,
          groupKey: "all-corequired",
          operator: RuleOperator.AND,
          isCorequisite: true,
        })),
      });
    }
  }

  await prisma.requirementGroup.deleteMany({ where: { catalogVersionId: catalogVersion.id } });
  for (const [groupIndex, group] of catalog.requirementGroups.entries()) {
    await prisma.requirementGroup.create({
      data: {
        key: group.id,
        catalogVersionId: catalogVersion.id,
        title: group.title,
        description: group.description,
        sortOrder: groupIndex,
        requirements: {
          create: group.items.map((item, itemIndex) => ({
            sourceKey: item.id,
            itemType: item.type === "course" ? RequirementItemType.COURSE : RequirementItemType.PLACEHOLDER,
            courseVersionId: item.courseId ? versionIdByCourseId.get(item.courseId) : undefined,
            label: item.label,
            description: item.description,
            recommendedSemester: item.courseId
              ? catalog.courses.find((course) => course.id === item.courseId)?.recommendedSemester
              : item.recommendedSemester,
            sortOrder: itemIndex,
          })),
        },
      },
    });
  }

  }
  const term = await prisma.term.upsert({
    where: { id: "fall-2026" },
    update: { name: "Fall 2026", sourceUrl: FALL_2026_SCHEDULE_SOURCE, fetchedAt: new Date(FALL_2026_FETCHED_AT) },
    create: { id: "fall-2026", name: "Fall 2026", sourceUrl: FALL_2026_SCHEDULE_SOURCE, fetchedAt: new Date(FALL_2026_FETCHED_AT) },
  });
  await prisma.section.deleteMany({ where: { termId: term.id } });
  const courseIdByCode = new Map(catalogs.flatMap((catalog) => catalog.courses).map((item) => [item.code, item.id]));
  await prisma.section.createMany({
    data: fall2026Offerings.map((offering) => ({
      termId: term.id,
      courseId: courseIdByCode.get(offering.courseCode)!,
      classNumber: offering.classNumber,
      sectionNumber: offering.sectionNumber,
      mode: offering.mode,
      component: offering.component,
      days: offering.days,
      times: offering.times,
      location: offering.location,
      dates: offering.dates,
      openSeats: offering.openSeats,
      instructors: offering.instructors,
    })),
  });
}

main().finally(async () => prisma.$disconnect());
