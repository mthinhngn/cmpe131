import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller("bootstrap")
export class BootstrapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async bootstrap() {
    const [programs, terms] = await Promise.all([
      this.prisma.program.findMany({
        include: {
          catalogVersions: {
            orderBy: { catalogYear: "desc" },
            take: 1,
            include: {
              courseVersions: {
                include: { course: true, roadmapItem: true, prerequisiteRules: true },
              },
            },
          },
        },
      }),
      this.prisma.term.findMany({
        orderBy: { label: "desc" },
        include: { sections: { include: { meetings: true, instructor: true } } },
      }),
    ]);
    return {
      programs: programs.map((program) => {
        const catalog = program.catalogVersions[0];
        return {
          name: program.name,
          abbreviation: program.abbreviation,
          catalog: catalog.catalogYear,
          dataVersion: catalog.dataVersion,
          sourceUrl: catalog.sourceUrl,
          semesterCount: catalog.semesterCount,
          courses: catalog.courseVersions.map((version) => ({
            id: version.course.id,
            code: version.course.code,
            title: version.title,
            units: version.units,
            description: version.description,
            recommendedSemester: version.roadmapItem?.recommendedSemester ?? 1,
            prerequisiteCourseIds: version.prerequisiteRules.map((rule) => rule.requiredCourseId),
            sourceUrl: catalog.sourceUrl,
          })),
        };
      }),
      terms: terms.map((term) => ({
        id: term.id,
        label: term.label,
        dataVersion: term.dataVersion,
        sourceUrl: term.sourceUrl,
        sections: term.sections.map((section) => ({
          id: section.id,
          courseId: section.courseId,
          term: term.label,
          sectionNumber: section.sectionNumber,
          instructor: section.instructor?.name ?? null,
          meetings: section.meetings.map((meeting) => ({
            days: meeting.days,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            location: meeting.location,
          })),
          availability: section.availability.toLowerCase(),
          openSeats: section.openSeats,
          sourceUrl: section.sourceUrl,
        })),
      })),
    };
  }
}
