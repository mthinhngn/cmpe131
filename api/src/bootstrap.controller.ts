import { Controller, Get, NotFoundException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller("bootstrap")
export class BootstrapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async bootstrap() {
    const program = await this.prisma.program.findUnique({
      where: { slug: "computer-engineering" },
      include: {
        catalogVersions: {
          orderBy: { catalogYear: "desc" },
          take: 1,
          include: {
            courseVersions: {
              include: { course: true, prerequisiteRules: true },
            },
            requirementGroups: {
              orderBy: { sortOrder: "asc" },
              include: { requirements: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    });
    const version = program?.catalogVersions[0];
    if (!program || !version) throw new NotFoundException("Computer Engineering catalog was not found");
    return {
      catalog: {
        name: program.name,
        abbreviation: program.abbreviation,
        catalogYear: version.catalogYear,
        dataVersion: version.dataVersion,
        dataStatus: version.lastVerifiedAt ? "reviewed" : "draft-unverified",
        sourceUrl: version.sourceUrl,
        programUrl: "https://www.sjsu.edu/cmpe/undergraduate_programs/bscmpe/index.php",
        courses: version.courseVersions.map((courseVersion) => ({
          id: courseVersion.course.id,
          code: courseVersion.course.code,
          title: courseVersion.title,
          units: courseVersion.units,
          description: courseVersion.description,
          recommendedSemester: version.requirementGroups
            .flatMap((group) => group.requirements)
            .find((requirement) => requirement.courseVersionId === courseVersion.id)?.recommendedSemester ?? 1,
          prerequisiteCourseIds: courseVersion.prerequisiteRules.map((rule) => rule.requiredCourseId),
          sourceUrl: version.sourceUrl,
        })),
        requirementGroups: version.requirementGroups.map((group) => ({
          id: group.id,
          title: group.title,
          description: group.description,
          items: group.requirements.map((requirement) => ({
            id: requirement.id,
            type: requirement.itemType.toLowerCase(),
            courseId: requirement.courseVersionId
              ? version.courseVersions.find((courseVersion) => courseVersion.id === requirement.courseVersionId)?.courseId
              : undefined,
            label: requirement.label ?? undefined,
            description: requirement.description ?? undefined,
            recommendedSemester: requirement.recommendedSemester ?? undefined,
          })),
        })),
      },
    };
  }
}
