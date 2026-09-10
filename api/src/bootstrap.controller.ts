import { Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller("bootstrap")
export class BootstrapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async bootstrap(@Query("program") slug = "computer-engineering") {
    if (!["computer-engineering", "software-engineering"].includes(slug)) throw new NotFoundException("Program not found");
    const program = await this.prisma.program.findUnique({
      where: { slug },
      include: {
        catalogVersions: {
          where: { catalogYear: "2026-2027" },
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
    if (!program || !version) throw new NotFoundException("Requested program catalog was not found");
    const currentTerm = await this.prisma.term.findUnique({
      where: { id: "fall-2026" },
      include: { sections: { include: { course: true }, orderBy: [{ course: { code: "asc" } }, { sectionNumber: "asc" }] } },
    });
    return {
      catalog: {
        name: program.name,
        abbreviation: program.abbreviation,
        catalogYear: version.catalogYear,
        dataVersion: version.dataVersion,
        dataStatus: version.lastVerifiedAt ? "reviewed" : "draft-unverified",
        lastVerifiedAt: version.lastVerifiedAt?.toISOString().slice(0, 10) ?? "",
        sourceUrl: version.sourceUrl,
        programUrl: version.sourceUrl,
        currentTerm: {
          id: currentTerm?.id ?? "fall-2026",
          name: currentTerm?.name ?? "Fall 2026",
          sourceUrl: currentTerm?.sourceUrl ?? "https://www.sjsu.edu/classes/schedules/fall-2026.php",
          fetchedAt: currentTerm?.fetchedAt.toISOString() ?? "",
        },
        offerings: currentTerm?.sections.map((section) => ({
          courseCode: section.course.code,
          sectionNumber: section.sectionNumber,
          classNumber: section.classNumber,
          mode: section.mode,
          component: section.component,
          days: section.days,
          times: section.times,
          location: section.location,
          dates: section.dates,
          openSeats: section.openSeats,
          instructors: section.instructors,
        })) ?? [],
        courses: version.courseVersions.map((courseVersion) => ({
          id: courseVersion.course.id,
          code: courseVersion.course.code,
          title: courseVersion.title,
          units: courseVersion.units,
          description: courseVersion.description,
          recommendedSemester: version.requirementGroups
            .flatMap((group) => group.requirements)
            .find((requirement) => requirement.courseVersionId === courseVersion.id)?.recommendedSemester ?? 1,
          prerequisiteCourseIds: courseVersion.prerequisiteRules.filter((rule) => !rule.isCorequisite).map((rule) => rule.requiredCourseId),
          corequisiteCourseIds: courseVersion.prerequisiteRules.filter((rule) => rule.isCorequisite).map((rule) => rule.requiredCourseId),
          prerequisiteText: courseVersion.prerequisiteText ?? undefined,
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
