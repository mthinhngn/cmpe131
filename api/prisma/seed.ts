import { PrismaClient, RequirementItemType, RuleOperator } from "@prisma/client";
import { computerEngineeringCatalog } from "../../src/data";

const prisma = new PrismaClient();

async function main() {
  const catalog = computerEngineeringCatalog;
  const program = await prisma.program.upsert({
    where: { slug: "computer-engineering" },
    update: { name: catalog.name, abbreviation: catalog.abbreviation },
    create: { slug: "computer-engineering", name: catalog.name, abbreviation: catalog.abbreviation },
  });
  const catalogVersion = await prisma.catalogVersion.upsert({
    where: { programId_catalogYear: { programId: program.id, catalogYear: catalog.catalogYear } },
    update: { dataVersion: catalog.dataVersion, sourceUrl: catalog.sourceUrl, semesterCount: 10 },
    create: {
      programId: program.id,
      catalogYear: catalog.catalogYear,
      dataVersion: catalog.dataVersion,
      sourceUrl: catalog.sourceUrl,
      semesterCount: 10,
    },
  });

  const versionIdByCourseId = new Map<string, string>();
  for (const item of catalog.courses) {
    await prisma.course.upsert({ where: { id: item.id }, update: { code: item.code }, create: { id: item.id, code: item.code } });
    const version = await prisma.courseVersion.upsert({
      where: { courseId_catalogVersionId: { courseId: item.id, catalogVersionId: catalogVersion.id } },
      update: { title: item.title, description: item.description, units: item.units },
      create: { courseId: item.id, catalogVersionId: catalogVersion.id, title: item.title, description: item.description, units: item.units },
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

main().finally(async () => prisma.$disconnect());
