import { universityCourses } from "./university.controller";
import { createHash } from "node:crypto";
import { BadRequestException, Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { COURSE_CATEGORIES, courseCategory } from "./course-category";
import { PrismaService } from "./prisma/prisma.service";
import type { ProgramCatalog } from "./course-types";
import { choiceRule, requirementName, universityRequirement, type SourceSection } from "./graduation-requirements";
import { catalogDesignations } from "./requirement-choices";
import { correctedSections, publishedRecords, recordId, recordListing, resolveRecord, sourceView } from "./requirement-records";

const TECHNICAL_ELECTIVES = "technical-electives";

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

  @Get("requirement-menu")
  async requirementMenu(@Query("program") slug = "", @Query("catalogYear") year?: string, @Query("view") view?: string) {
    const { catalog, catalogVersionId } = await this.readCatalog(slug);
    if (view === "assistant") {
      // Real requirements only: one row per checked record, never roadmap slot labels or summary sections.
      const records = (year && year !== catalog.catalogYear ? [] : publishedRecords(slug, catalog.catalogYear))
        .sort((a, b) => Number(a.scope === "campus") - Number(b.scope === "campus"));
      return { program: slug, catalogYear: catalog.catalogYear, requirements: records.map(record => {
        const source = record.sources[0];
        return { id: recordId(record, catalogVersionId), label: record.title, scope: record.scope, kind: record.rule.kind,
          verificationStatus: record.verification.status, needsReview: Boolean(record.needs_review), pattern: record.applicability.pattern,
          aliases: record.aliases.map(alias => ({ text: alias.text, kind: alias.kind })),
          sourceUrl: source?.url ?? null, checkedOn: source ? sourceView(source).checkedOn : null };
      }) };
    }
    const requirements = year && year !== catalog.catalogYear ? [] : [
      { key: TECHNICAL_ELECTIVES, label: "Technical electives" },
      { key: "required-courses", label: "Required roadmap courses" },
      ...this.programChoices(catalog),
    ];
    return { program: slug, catalogYear: catalog.catalogYear, requirements: requirements.map(({ key, label }) => ({
      id: `${catalogVersionId}:${key}`, label, sourceUrl: catalog.sourceUrl, checkedOn: catalog.lastVerifiedAt || null,
    })) };
  }

  private programChoices(catalog: Awaited<ReturnType<BootstrapController["readCatalog"]>>["catalog"]) {
    const sourceSections: SourceSection[] = (catalog.requirementEvidence ?? []).filter((section: SourceSection) => section.choice && section.title);
    const occurrences = new Map<string, number>();
    const choices = sourceSections.map(section => {
      const key = requirementName(section.title).replace(/ /g, "-");
      const occurrence = (occurrences.get(key) ?? 0) + 1;
      occurrences.set(key, occurrence);
      return { key: `catalog-choice-${key}-${occurrence}`, label: section.title, description: section.text, units: section.units, options: section.courses ?? [] };
    });
    const labels = new Set(choices.map(choice => requirementName(choice.label)));
    for (const item of catalog.requirementGroups.flatMap(group => group.items)) {
      if (item.type !== "placeholder" || !item.label || labels.has(requirementName(item.label))) continue;
      choices.push({ key: `choice-${item.id}`, label: item.label, description: item.description ?? item.label, units: undefined, options: [] });
    }
    return choices;
  }

  /** Read-only requirement list for the assistant, derived from the same classification the Planner shows. */
  @Get("requirements")
  async requirements(@Query("program") slug = "", @Query("requirement") requirement = "technical-electives", @Query("catalogYear") year?: string, @Query("view") view?: string) {
    if (typeof requirement !== "string" || requirement.length > 200 || !requirement.trim()) throw new BadRequestException("Invalid requirement.");
    if (view !== "assistant") return this.catalogRequirements(slug, requirement, year);
    const { catalog, catalogVersionId } = await this.readCatalog(slug);
    const empty = { program: slug, programName: catalog.name, catalogYear: catalog.catalogYear, dataVersion: catalog.dataVersion, requirement, courses: [], sources: [] };
    if (year && year !== catalog.catalogYear) return { ...empty, status: "catalog_unavailable", requestedYear: year };
    const { records } = resolveRecord(slug, catalog.catalogYear, catalogVersionId, requirement);
    if (records.length > 1) {
      return { ...empty, status: "ambiguous_requirement", candidates: records.map(record => ({ id: recordId(record, catalogVersionId), label: record.title,
        scope: record.scope, pattern: record.applicability.pattern })) };
    }
    if (records.length === 1) {
      const planner = new Map(catalog.courses.map(course => [course.code, { id: course.id, title: course.title, units: course.units }]));
      const { courses: _, sources: __, ...base } = empty;
      const listing = recordListing(records[0], catalogVersionId, planner);
      if (records[0].scope !== "campus") return { ...base, ...listing };
      // The major's own catalog text can say major coursework covers or waives this campus requirement.
      const target = `campus:sjsu:${records[0].catalog_year}:${records[0].requirement_key}`;
      const programRecords = publishedRecords(slug, catalog.catalogYear).filter(record => record.scope === "program");
      const majorEffects = programRecords.flatMap(record =>
        record.applicability.program_effects.filter(effect => effect.target_requirement_id === target).map(effect => {
          const source = record.sources.find(item => effect.source_refs.includes(item.key));
          return { effect: effect.effect, text: effect.text, requirement: record.title, requirementId: recordId(record, catalogVersionId),
            needsReview: Boolean(record.needs_review), source: source ? sourceView(source) : null };
        }));
      const summary = programRecords.flatMap(record => record.sources).find(source =>
        /^Summary of Degree Units\b/i.test(source.quote ?? "") || /degree-summary$|ge-summary$/.test(source.key));
      return { ...base, ...listing, majorEffects, degreeSummary: summary ? sourceView(summary) : null };
    }
    const legacy = await this.catalogRequirements(slug, requirement, year);
    // Anything not backed by a checked record is staging evidence for the assistant, never a course list.
    const key = String(("requirementId" in legacy && legacy.requirementId) || legacy.requirement).split(":").pop() ?? "";
    return /^(?:catalog-choice-|choice-)/.test(key) ? { ...legacy, verificationStatus: "extracted" } : legacy;
  }

  private async catalogRequirements(slug: string, requirement: string, year?: string) {
    const { catalog, eligibility, catalogVersionId } = await this.readCatalog(slug);
    const base = { program: slug, programName: catalog.name, catalogYear: catalog.catalogYear, dataVersion: catalog.dataVersion };
    const schoolPrefix = `sjsu:${catalog.catalogYear}:`;
    const school = universityRequirement(requirement.startsWith(schoolPrefix) ? requirement.slice(schoolPrefix.length) : requirement);
    const requested = requirement.startsWith(catalogVersionId + ":") ? requirement.slice(catalogVersionId.length + 1) : requirement;
    const name = requirementName(requested);
    const catalogSource = { kind: "catalog_program", url: catalog.sourceUrl, checkedOn: catalog.lastVerifiedAt || null };
    const plannerByCode = new Map(catalog.courses.map(course => [course.code, course]));
    const catalogEntry = (code: string, title = "", units?: number) => {
      const course = plannerByCode.get(code);
      return { code, courseId: course?.id ?? null, title: course?.title ?? title, units: course?.units ?? units ?? null,
        sections: null, term: null, topic: null, condition: null, inPlannerCatalog: Boolean(course), source: catalogSource };
    };
    const empty = { ...base, requirement, courses: [], sources: [] };
    if (year && year !== catalog.catalogYear) return { ...empty, status: "catalog_unavailable", requestedYear: year };
    if (school?.candidates) return { ...empty, status: "ambiguous_requirement", candidates: school.candidates.map(label => ({ label })) };
    if (school && "attributes" in school) {
      return { ...empty, status: "partial", requirement: school.key, requirementId: `sjsu:${catalog.catalogYear}:${school.key}`,
        label: school.label, attributes: school.attributes, coverage: "section_designations",
        courses: catalog.courses.filter(course => school.attributes.some(tag => catalogDesignations(course.description).includes(tag))).map(course => catalogEntry(course.code)),
        sources: [catalogSource] };
    }
    if (/^(?:required(?: major)? courses?|major required courses?|named roadmap courses?)$/.test(name)) {
      const ids = new Set(catalog.roadmapCourseIds);
      const courses = catalog.courses.filter(course => ids.has(course.id)).map(course => catalogEntry(course.code));
      return { ...base, requirement: "required-courses", requirementId: `${catalogVersionId}:required-courses`, label: "Required roadmap courses",
        status: courses.length ? "verified" : "partial", courses, sources: [catalogSource],
        rule: { all: true, text: "Named courses in the selected roadmap. Choice groups and other graduation conditions are checked separately." } };
    }
    if (!/^(?:tech(?:nical)?(?: upper division)? electives?|upper division technical electives?|tes?|môn tự chọn kỹ thuật)$/.test(name)) {
      const choices = this.programChoices(catalog);
      const exact = choices.filter(choice => {
        const title = requirementName(choice.label);
        return choice.key === requested || title === name || choice.options.some(option => name === `${title} ${requirementName(option.code)}`);
      });
      const matches = exact.length ? exact : choices.filter(choice =>
        /^(?:choice groups?|elective choices|choose one|choose two)$/.test(name) || (name.length >= 4 && requirementName(choice.label).includes(name)));
      if (matches.length > 1) {
        return { ...empty, status: "ambiguous_requirement", candidates: matches.map(choice => ({
          id: `${catalogVersionId}:${choice.key}`, label: choice.label, examples: choice.options.slice(0, 3).map(option => option.code),
        })) };
      }
      const choice = matches[0];
      if (!choice) return { ...empty, status: "unknown_requirement" };
      const rule = choiceRule(choice.label, choice.description, choice.units);
      const courses = choice.options.map(option => catalogEntry(option.code, option.title, option.units));
      return { ...base, requirement: choice.key, requirementId: `${catalogVersionId}:${choice.key}`, label: choice.label,
        status: courses.length ? (rule.manualReview ? "partial" : "verified") : "open_rule",
        rule, courses, sources: [catalogSource] };
    }
    const byCode = new Map(eligibility.map(entry => [entry.code, {
      code: entry.code, courseId: entry.courseId, title: "", units: null as number | null,
      inPlannerCatalog: false,
      rules: [] as { sections: string[] | null; term: string | null; topic: string | null;
        condition: string | null; source: typeof catalogSource }[],
    }]));
    for (const entry of eligibility) {
      const choice = byCode.get(entry.code)!;
      const course = plannerByCode.get(entry.code);
      choice.title = course?.title ?? "";
      if (course?.plannerCategory === "technical") {
        Object.assign(choice, { courseId: course.id, units: course.units, inPlannerCatalog: true });
      }
      choice.rules.push({
        sections: entry.sectionNumbers.length ? entry.sectionNumbers : null,
        term: entry.termId, topic: entry.topic, condition: entry.conditionText,
        source: { kind: entry.sourceKind, url: entry.sourceUrl, checkedOn: entry.checkedOn.toISOString().slice(0, 10) },
      });
    }
    const courses = [...byCode.values()];
    const slots = catalog.requirementGroups.flatMap(group => group.items)
      .filter(item => item.type === "placeholder" && /technical.*elective/i.test(item.label ?? ""))
      .map(item => ({ label: item.label, description: item.description ?? null }));
    return {
      ...base, requirement: TECHNICAL_ELECTIVES, label: "Technical electives",
      requirementId: `${catalogVersionId}:${TECHNICAL_ELECTIVES}`,
      status: courses.length ? "verified" : "no_source",
      rule: { slots, sourceUrl: catalog.sourceUrl },
      courses: courses.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })),
      sources: [...new Map(courses.flatMap(c => c.rules.map(({ source }) => [source.url, source] as const))).values()],
    };
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
      plannerCategory: required.has(c.id) ? courseCategory(c.code) : c.plannerCategory,
    })), requirementGroups: groups, roadmapCourseIds: [...required], sequenceKind: "draft",
      selectedPrograms: [primary, ...extras].flatMap(c => c.selectedPrograms ?? []),
      requirementEvidence: [primary, ...extras].flatMap(c => c.requirementEvidence ?? []),
      dataVersion: [primary, ...extras].map(c => c.dataVersion).join(":") };
  }

  @Get()
  async bootstrap(@Query("program") slug = "computer-engineering", @Query("category") category?: string) {
    const { catalog } = await this.readCatalog(slug, category);
    return { catalog };
  }

  private async readCatalog(slug: string, category?: string) {
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
            courseEligibility: {
              where: { requirementKey: TECHNICAL_ELECTIVES },
              include: { course: { select: { code: true } } },
              orderBy: [{ courseId: "asc" }, { id: "asc" }],
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
    const degreeCodes = new Set(version.courseVersions.filter(c => degreeIds.has(c.courseId)).map(c => c.course.code));
    const eligibility = version.courseEligibility
      .map(({ course, ...entry }) => ({ ...entry, code: course.code,
        termId: entry.termId || null, topic: entry.topic || null, conditionText: entry.conditionText || null }))
      .filter(entry => !degreeCodes.has(entry.code));
    // Planner still displays imported program classifications when the catalog provides them.
    const technicalCodes = new Set<string>(metadata?.technicalCodes ?? eligibility
      .filter(entry => entry.sourceKind === "department_list" && !entry.sectionNumbers.length && !entry.topic && !entry.termId && !entry.conditionText)
      .map(entry => entry.code));
    const eligibilityRevision = createHash("sha256").update(JSON.stringify(eligibility)).digest("hex").slice(0, 12);
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
      catalogVersionId: version.id,
      eligibility,
      catalog: {
        name: program.name,
        sequenceKind: metadata?.sequenceKind ?? "official",
        selectedPrograms: [{ slug, title: program.name, kind: metadata?.kind ?? "bachelor", sourceUrl: version.sourceUrl }],
        requirementEvidence: correctedSections(slug, metadata?.sections ?? []).map((section: any) => ({ ...section, program: program.name })),
        abbreviation: program.abbreviation,
        catalogYear: version.catalogYear,
        dataVersion: version.courseEligibility.length
          ? `${version.dataVersion}:relationships-v1:electives-v3:${eligibilityRevision}:${shared.length}`
          : `${version.dataVersion}:relationships-v1:electives-v2:${shared.length}`,
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
          .map(course => ({ ...course, plannerCategory: !degreeIds.has(course.id) && technicalCodes.has(course.code) ? "technical" as const : courseCategory(course.code, degreeIds.has(course.id)) }))
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
