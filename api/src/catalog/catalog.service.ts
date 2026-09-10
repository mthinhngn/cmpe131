import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async programs() {
    return this.prisma.program.findMany({
      orderBy: { name: "asc" },
      include: { catalogVersions: { select: { catalogYear: true, dataVersion: true, lastVerifiedAt: true } } },
    });
  }

  async requirements(slug: string, catalogYear?: string) {
    const program = await this.prisma.program.findUnique({
      where: { slug },
      include: {
        catalogVersions: {
          where: catalogYear ? { catalogYear } : undefined,
          orderBy: { catalogYear: "desc" },
          take: 1,
          include: {
            requirementGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                requirements: {
                  orderBy: { sortOrder: "asc" },
                  include: { courseVersion: { include: { course: true, prerequisiteRules: { include: { requiredCourse: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    const catalog = program?.catalogVersions[0];
    if (!program || !catalog) throw new NotFoundException("Program or catalog year was not found");
    return {
      dataVersion: catalog.dataVersion,
      sourceUrl: catalog.sourceUrl,
      lastVerifiedAt: catalog.lastVerifiedAt,
      program: { id: program.id, slug: program.slug, name: program.name, abbreviation: program.abbreviation },
      catalogYear: catalog.catalogYear,
      requirementGroups: catalog.requirementGroups,
    };
  }
}
