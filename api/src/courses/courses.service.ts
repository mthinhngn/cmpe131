import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async course(id: string, catalogYear?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        versions: {
          where: catalogYear ? { catalogVersion: { catalogYear } } : undefined,
          include: { catalogVersion: true, prerequisiteRules: { include: { requiredCourse: true } } },
        },
      },
    });
    if (!course?.versions[0]) throw new NotFoundException("Course was not found for that catalog year");
    const version = course.versions[0];
    return { ...course, versions: undefined, version, dataVersion: version.catalogVersion.dataVersion };
  }

  async sections(id: string, termId: string) {
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException("Term was not found");
    const sections = await this.prisma.section.findMany({
      where: { courseId: id, termId },
      include: { meetings: true, instructor: true },
      orderBy: { sectionNumber: "asc" },
    });
    return { dataVersion: term.dataVersion, sourceUrl: term.sourceUrl, lastVerifiedAt: term.verifiedAt, sections };
  }
}
