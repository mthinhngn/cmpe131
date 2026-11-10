import { universityCourses } from "./university.controller";
import { BadRequestException, Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { COURSE_CATEGORIES, courseCategory } from "./course-category";
import { PrismaService } from "./prisma/prisma.service";
import type { ProgramCatalog } from "./course-types";

@Controller("bootstrap")
export class BootstrapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("programs")
  async programs() {
    const programs = await this.prisma.$queryRaw<{ slug: string; title: string; kind: string }[]>`
      SELECT p.slug,CASE WHEN p.abbreviation IN ('BSCMPE','BSSE') THEN p.name || ' — BS' ELSE p.name END AS title,
      COALESCE(v."programMetadata"->>'kind','bachelor') AS kind
      FROM "Program" p JOIN "CatalogVersion" v ON v."programId"=p.id WHERE v."catalogYear"='2026-2027' ORDER BY p.name`;
    return { catalogYear: "2026-2027", programs };
  }

  async compose(slug: string, additional: unknown = []): Promise<ProgramCatalog> {
    if (!Array.isArray(additional) || additional.length > 10 || additional.some(p => typeof p !== "string" || !/^[a-z0-9-]{1,120}$/.test(p)) || new Set(additional).size !== additional.length || additional.includes(slug)) throw new BadRequestException("Choose distinct minors or certificates.");
    const primary = (await this.bootstrap(slug)).catalog as ProgramCatalog;
    if (!additional.length) return primary;
    const extras = await Promise.all(additional.map(async key => (await this.bootstrap(key)).catalog as ProgramCatalog));
    if (extras.some(c => !["minor", "certificate"].includes(c.selectedPrograms?.[0]?.kind ?? ""))) throw new BadRequestException("Additional programs must be minors or certificates.");
    const courses = new Map(primary.courses.map(c => [c.code, c]));
    const groups = primary.requirementGroups.map(g => ({ ...g, items: [...g.items] }));
    const required = new Set(groups.flatMap(g => g.items.flatMap(i => i.courseId ? [i.courseId] : [])));
    for (const extra of extras) {
      const remap = new Map(extra.courses.map(c => [c.id, courses.get(c.code)?.id ?? c.id]));
      extra.courses.forEach(c => { if (!courses.has(c.code)) courses.set(c.code, { ...c, prerequisiteCourseIds: c.prerequisiteCourseIds.map(id => remap.get(id) ?? id), corequisiteCourseIds: c.corequisiteCourseIds.map(id => remap.get(id) ?? id) }); });
      extra.requirementGroups.forEach(g => {
        const items = g.items.flatMap(i => {
          const courseId = i.courseId ? remap.get(i.courseId) ?? i.courseId : undefined;
          if (courseId && required.has(courseId)) return [];
          if (courseId) required.add(courseId);
          return [{ ...i, id: `${extra.selectedPrograms![0].slug}:${i.id}`, courseId, recommendedSemester: groups.length + 1 }];
        });
        if (items.length) groups.push({ ...g, id: `additional-${groups.length}`, title: `Suggested semester ${groups.length + 1}`, description: `${extra.name}. Draft placement; verify shared-credit restrictions with your advisor.`, items });
      });
    }
    const semesterByCourse = new Map(groups.flatMap((g, index) => g.items.flatMap(i => i.courseId ? [[i.courseId, index + 1] as const] : [])));
    return { ...primary, courses: [...courses.values()].map(c => ({ ...c,
      recommendedSemester: semesterByCourse.get(c.id) ?? c.recommendedSemester,
      plannerCategory: required.has(c.id) ? courseCategory(c.code, true, slug) : c.plannerCategory,
    })), requirementGroups: groups, roadmapCourseIds: [...required], sequenceKind: "draft",
      selectedPrograms: [primary, ...extras].flatMap(c => c.selectedPrograms ?? []),
      requirementEvidence: [primary, ...extras].flatMap(c => c.requirementEvidence ?? []),
      dataVersion: [primary, ...extras].map(c => c.dataVersion).join(":") };
  }

  @Get()
  async bootstrap(@Query("program") slug = "computer-engineering", @Query("category") category?: string) {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new NotFoundException("Program not found");
    if (category && !COURSE_CATEGORIES.some(key => key === category)) throw new BadRequestException("Unknown course category");
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
    const metadata = version.programMetadata as any;
    const currentTerm = await this.prisma.term.findUnique({
      where: { id: "fall-2026" },
      include: { sections: { where: { courseId: { in: version.courseVersions.map(course => course.courseId) } }, include: { course: true }, orderBy: [{ course: { code: "asc" } }, { sectionNumber: "asc" }] } },
    });
    const shared = await universityCourses(this.prisma);
    const sharedByCode = new Map(shared.map(c => [c.code, c]));
    const requiredVersionIds = new Set(version.requirementGroups.flatMap(g => g.requirements.flatMap(r => r.courseVersionId ? [r.courseVersionId] : [])));
    const degreeIds = new Set(version.courseVersions.filter(c => requiredVersionIds.has(c.id)).map(c => c.courseId));
    const versionIds = new Set(version.courseVersions.map(c => c.courseId));
    const importedTerms = await this.prisma.term.findMany({ orderBy: { id: "asc" } });
    const requirements = version.requirementGroups.flatMap(group => group.requirements);
    const semesterByVersion = new Map<string, number | null>();
    for (const requirement of requirements) {
      if (requirement.courseVersionId && !semesterByVersion.has(requirement.courseVersionId)) {
        semesterByVersion.set(requirement.courseVersionId, requirement.recommendedSemester);
      }
    }
    const courseIdByVersion = new Map(version.courseVersions.map(course => [course.id, course.courseId]));
    return {
      catalog: {
        name: program.name,
        sequenceKind: metadata?.sequenceKind ?? "official",
        selectedPrograms: [{ slug, title: program.name, kind: metadata?.kind ?? "bachelor", sourceUrl: version.sourceUrl }],
        requirementEvidence: metadata?.sections?.map((section: any) => ({ ...section, program: program.name })) ?? [],
        abbreviation: program.abbreviation,
        catalogYear: version.catalogYear,
        dataVersion: `${version.dataVersion}:relationships-v1:electives-v2:${shared.length}`,
        availableTerms: importedTerms.map(t => t.id).sort((a, b) => { const order = (t: string) => Number(t.split("-")[1]) * 4 + ["winter", "spring", "summer", "fall"].indexOf(t.split("-")[0]); return order(a) - order(b); }),
        roadmapCourseIds: [...degreeIds],
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
        courses: [...version.courseVersions.map((courseVersion) => ({
          id: courseVersion.course.id,
          code: courseVersion.course.code,
          title: courseVersion.title,
          units: courseVersion.units,
          description: courseVersion.description,
          recommendedSemester: semesterByVersion.get(courseVersion.id) ?? 1,
          prerequisiteCourseIds: (metadata ? sharedByCode.get(courseVersion.course.code)?.prerequisiteCourseIds : undefined) ?? courseVersion.prerequisiteRules.filter((rule) => !rule.isCorequisite).map((rule) => rule.requiredCourseId),
          prerequisiteOptionCourseIds: metadata ? sharedByCode.get(courseVersion.course.code)?.prerequisiteOptionCourseIds : undefined,
          corequisiteCourseIds: (metadata ? sharedByCode.get(courseVersion.course.code)?.corequisiteCourseIds : undefined) ?? courseVersion.prerequisiteRules.filter((rule) => rule.isCorequisite).map((rule) => rule.requiredCourseId),
          corequisiteOptionCourseIds: metadata ? sharedByCode.get(courseVersion.course.code)?.corequisiteOptionCourseIds : undefined,
          prerequisiteText: courseVersion.prerequisiteText ?? undefined,
          sourceUrl: sharedByCode.get(courseVersion.course.code)?.sourceUrl ?? version.sourceUrl,
        })), ...shared.filter(c => !versionIds.has(c.id))]
          .map(course => ({ ...course, plannerCategory: !degreeIds.has(course.id) && metadata?.technicalCodes?.includes(course.code) ? "technical" as const : courseCategory(course.code, degreeIds.has(course.id), slug) }))
          .filter(course => !category || course.plannerCategory === category),
        requirementGroups: version.requirementGroups.map((group) => ({
          id: group.key,
          title: group.title,
          description: group.description,
          items: group.requirements.map((requirement) => ({
            id: requirement.sourceKey,
            type: requirement.itemType.toLowerCase(),
            courseId: requirement.courseVersionId
              ? courseIdByVersion.get(requirement.courseVersionId)
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
