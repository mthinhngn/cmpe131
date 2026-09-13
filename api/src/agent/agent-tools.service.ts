import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  alternativeSectionsArgsSchema,
  buildAutonomousScheduleArgsSchema,
  courseIdsArgsSchema,
  generateCandidatesArgsSchema,
  searchSectionsArgsSchema,
  validateScheduleArgsSchema,
  type AgentRequest,
  type AgentSection,
  type ScheduleProposal,
  type ScheduleDecisionTrace,
} from "./agent.schemas";
import { buildAutonomousSchedule, type AutonomousCourse } from "./autonomous-schedule-domain";
import { findConflicts, generateScheduleCandidates, parseMeeting, sectionsConflict, unavailableConflict } from "./schedule-domain";
import { evaluatePrerequisiteWarnings, type PrerequisiteCourse } from "./prerequisite-domain";

export const AGENT_TOOL_NAMES = [
  "get_current_plan",
  "get_course_requirements",
  "search_sections",
  "find_alternative_sections",
  "generate_schedule_candidates",
  "validate_schedule",
  "build_autonomous_schedule",
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export const GEMINI_TOOLS = [
  { type: "function", name: "get_current_plan", description: "Read the student's session-only planner, completed courses, selected section class numbers, unavailable times, and preferences.", parameters: { type: "object", properties: {}, additionalProperties: false } },
  { type: "function", name: "get_course_requirements", description: "Read complete prerequisite and corequisite rule groups for catalog course IDs.", parameters: { type: "object", properties: { courseIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 } }, required: ["courseIds"], additionalProperties: false } },
  { type: "function", name: "search_sections", description: "Search authoritative database sections for catalog course IDs in the selected term.", parameters: { type: "object", properties: { courseIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 }, component: { type: "string" }, openOnly: { type: "boolean" } }, required: ["courseIds"], additionalProperties: false } },
  { type: "function", name: "find_alternative_sections", description: "Find same-course, same-component alternatives for one selected class number while checking the rest of the current schedule and unavailable times.", parameters: { type: "object", properties: { classNumber: { type: "string" } }, required: ["classNumber"], additionalProperties: false } },
  { type: "function", name: "generate_schedule_candidates", description: "Deterministically combine one section per component for the requested courses, filter conflicts and unavailable times, and rank up to three schedules.", parameters: { type: "object", properties: { courseIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 }, maxResults: { type: "integer", minimum: 1, maximum: 3 } }, required: ["courseIds"], additionalProperties: false } },
  { type: "function", name: "validate_schedule", description: "Deterministically validate section class numbers for conflicts, unknown sections, TBA meetings, and prerequisite concerns.", parameters: { type: "object", properties: { classNumbers: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 40 } }, required: ["classNumbers"], additionalProperties: false } },
  { type: "function", name: "build_autonomous_schedule", description: "Build a complete 12-15 unit schedule without requiring course IDs. Reads the official roadmap, completed courses, prerequisite graph, current hard-locked sections, open term sections, unavailable times, and backtracks to different eligible courses when needed.", parameters: { type: "object", properties: { requiredCourseCodes: { type: "array", items: { type: "string" }, maxItems: 8 }, avoidDays: { type: "array", items: { type: "string", enum: ["M", "T", "W", "R", "F", "S", "U"] }, maxItems: 7 }, minimumUnits: { type: "integer", minimum: 1, maximum: 18 }, targetUnits: { type: "integer", minimum: 1, maximum: 18 }, maxResults: { type: "integer", minimum: 1, maximum: 3 } }, additionalProperties: false } },
] as const;

export type ToolExecution = {
  data: unknown;
  summary: string;
  proposals?: ScheduleProposal[];
  warnings?: string[];
  decisionTrace?: ScheduleDecisionTrace;
};

@Injectable()
export class AgentToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCatalogAvailable(context: AgentRequest) {
    const [catalogVersion, term] = await Promise.all([
      this.catalogVersion(context),
      this.prisma.term.findUnique({ where: { id: context.termId }, select: { id: true } }),
    ]);
    if (!catalogVersion || !term) throw new Error("Catalog database is unavailable for the selected program and term");
  }

  async execute(name: AgentToolName, rawArguments: unknown, context: AgentRequest): Promise<ToolExecution> {
    switch (name) {
      case "get_current_plan":
        if (!rawArguments || typeof rawArguments !== "object" || Array.isArray(rawArguments) || Object.keys(rawArguments).length) throw new Error("Invalid get_current_plan arguments");
        return {
          data: {
            program: context.program,
            catalogYear: context.catalogYear,
            termId: context.termId,
            completedCourseIds: context.completedCourseIds,
            planEntries: context.planEntries,
            selectedClassNumbers: context.selectedClassNumbers,
            unavailableTimes: context.unavailableTimes,
            preferences: context.preferences,
          },
          summary: `Read ${context.planEntries.length} planned courses and ${context.selectedClassNumbers.length} selected sections.`,
        };
      case "get_course_requirements":
        return this.getCourseRequirements(courseIdsArgsSchema.parse(rawArguments), context);
      case "search_sections":
        return this.searchSections(searchSectionsArgsSchema.parse(rawArguments), context);
      case "find_alternative_sections":
        return this.findAlternativeSections(alternativeSectionsArgsSchema.parse(rawArguments), context);
      case "generate_schedule_candidates":
        return this.generateCandidates(generateCandidatesArgsSchema.parse(rawArguments), context);
      case "validate_schedule":
        return this.validateSchedule(validateScheduleArgsSchema.parse(rawArguments), context);
      case "build_autonomous_schedule":
        return this.buildAutonomousSchedule(buildAutonomousScheduleArgsSchema.parse(rawArguments), context);
    }
  }

  private async catalogVersion(context: AgentRequest) {
    return this.prisma.catalogVersion.findFirst({
      where: { catalogYear: context.catalogYear, program: { slug: context.program } },
      select: { id: true },
    });
  }

  private mapSection(section: {
    courseId: string; classNumber: string; sectionNumber: string; mode: string; component: string;
    days: string; times: string; location: string; dates: string; openSeats: number; instructors: string[];
    course: { code: string };
  }): AgentSection {
    return {
      courseId: section.courseId,
      courseCode: section.course.code,
      classNumber: section.classNumber,
      sectionNumber: section.sectionNumber,
      mode: section.mode,
      component: section.component,
      days: section.days,
      times: section.times,
      location: section.location,
      dates: section.dates,
      openSeats: section.openSeats,
      instructors: section.instructors,
    };
  }

  private async sectionRecords(context: AgentRequest, options: { courseIds?: string[]; classNumbers?: string[]; component?: string; openOnly?: boolean } = {}) {
    return this.prisma.section.findMany({
      where: {
        termId: context.termId,
        ...(options.courseIds ? { courseId: { in: options.courseIds } } : {}),
        ...(options.classNumbers ? { classNumber: { in: options.classNumbers } } : {}),
        ...(options.component ? { component: options.component } : {}),
        ...(options.openOnly ? { openSeats: { gt: 0 } } : {}),
      },
      include: { course: { select: { code: true } } },
      orderBy: [{ course: { code: "asc" } }, { component: "asc" }, { sectionNumber: "asc" }],
    });
  }

  private async getCourseRequirements(args: { courseIds: string[] }, context: AgentRequest): Promise<ToolExecution> {
    const version = await this.catalogVersion(context);
    if (!version) throw new Error("Catalog version is unavailable");
    const courses = await this.prisma.course.findMany({
      where: { id: { in: args.courseIds } },
      select: {
        id: true,
        code: true,
        versions: {
          where: { catalogVersionId: version.id },
          select: {
            prerequisiteText: true,
            prerequisiteRules: {
              select: {
                groupKey: true,
                operator: true,
                minimumGrade: true,
                isCorequisite: true,
                requiresManualReview: true,
                requiredCourse: { select: { id: true, code: true } },
              },
              orderBy: [{ groupKey: "asc" }, { requiredCourse: { code: "asc" } }],
            },
          },
        },
      },
    });
    const data = courses.map((course) => ({
      courseId: course.id,
      courseCode: course.code,
      prerequisiteText: course.versions[0]?.prerequisiteText ?? null,
      rules: course.versions[0]?.prerequisiteRules ?? [],
    }));
    return { data, summary: `Checked prerequisite metadata for ${data.length} courses.` };
  }

  private async searchSections(args: { courseIds: string[]; component?: string; openOnly: boolean }, context: AgentRequest): Promise<ToolExecution> {
    const records = await this.sectionRecords(context, args);
    const sections = records.map((record) => this.mapSection(record));
    return { data: sections, summary: `Found ${sections.length} matching ${context.termId} sections.` };
  }

  private async findAlternativeSections(args: { classNumber: string }, context: AgentRequest): Promise<ToolExecution> {
    const original = await this.prisma.section.findUnique({ where: { termId_classNumber: { termId: context.termId, classNumber: args.classNumber } }, include: { course: { select: { code: true } } } });
    if (!original) return { data: [], summary: `Class ${args.classNumber} is not in the selected term.` };
    const otherRecords = await this.sectionRecords(context, { classNumbers: context.selectedClassNumbers.filter((number) => number !== args.classNumber) });
    const others = otherRecords.map((record) => this.mapSection(record));
    const alternatives = (await this.sectionRecords(context, { courseIds: [original.courseId], component: original.component }))
      .map((record) => this.mapSection(record))
      .filter((section) => section.classNumber !== args.classNumber)
      .map((section) => ({
        ...section,
        conflictsCurrentSchedule: others.some((other) => sectionsConflict(section, other)),
        conflictsUnavailableTime: unavailableConflict(section, context.unavailableTimes),
        meetingStatus: parseMeeting(section).status,
      }))
      .sort((left, right) => Number(left.conflictsCurrentSchedule || left.conflictsUnavailableTime) - Number(right.conflictsCurrentSchedule || right.conflictsUnavailableTime)
        || Number(right.openSeats > 0) - Number(left.openSeats > 0) || right.openSeats - left.openSeats);
    return {
      data: alternatives,
      summary: alternatives.length
        ? `Found ${alternatives.length} same-component alternatives for ${original.course.code} ${original.component}.`
        : `No other ${original.course.code} ${original.component} sections are available in ${context.termId}.`,
    };
  }

  private async prerequisiteWarnings(courseIds: string[], context: AgentRequest) {
    const requirements = await this.getCourseRequirements({ courseIds }, context);
    return evaluatePrerequisiteWarnings(requirements.data as PrerequisiteCourse[], context.completedCourseIds, courseIds);
  }

  private async generateCandidates(args: { courseIds: string[]; maxResults: number }, context: AgentRequest): Promise<ToolExecution> {
    const records = await this.sectionRecords(context, { courseIds: args.courseIds });
    const sections = records.map((record) => this.mapSection(record));
    const maxCombinations = Number(process.env.AGENT_MAX_COMBINATIONS ?? "5000");
    const proposals = generateScheduleCandidates({
      sections,
      courseIds: args.courseIds,
      unavailableTimes: context.unavailableTimes,
      earliestStartMinute: context.preferences.earliestStartMinute,
      latestEndMinute: context.preferences.latestEndMinute,
      maxResults: args.maxResults,
      maxCombinations: Number.isFinite(maxCombinations) && maxCombinations > 0 ? Math.min(maxCombinations, 25_000) : 5_000,
    });
    const prerequisiteWarnings = await this.prerequisiteWarnings(args.courseIds, context);
    const enriched = proposals.map((proposal) => ({ ...proposal, warnings: [...new Set([...proposal.warnings, ...prerequisiteWarnings])] }));
    const missingCourses = args.courseIds.filter((courseId) => !sections.some((section) => section.courseId === courseId));
    const warnings = missingCourses.length ? [`No ${context.termId} sections were found for: ${missingCourses.join(", ")}.`] : [];
    return {
      data: { candidateCount: enriched.length, proposals: enriched, missingCourseIds: missingCourses },
      proposals: enriched,
      warnings,
      summary: enriched.length ? `Generated ${enriched.length} conflict-free schedule candidate${enriched.length === 1 ? "" : "s"}.` : "No complete conflict-free schedule could be generated.",
    };
  }

  private async validateSchedule(args: { classNumbers: string[] }, context: AgentRequest): Promise<ToolExecution> {
    const records = await this.sectionRecords(context, { classNumbers: args.classNumbers });
    const sections = records.map((record) => this.mapSection(record));
    const found = new Set(sections.map((section) => section.classNumber));
    const unknown = args.classNumbers.filter((number) => !found.has(number));
    const conflicts = findConflicts(sections);
    const unavailable = sections.filter((section) => unavailableConflict(section, context.unavailableTimes)).map((section) => section.classNumber);
    const uncertain = sections.filter((section) => parseMeeting(section).status !== "scheduled").map((section) => section.classNumber);
    const warnings = await this.prerequisiteWarnings([...new Set(sections.map((section) => section.courseId))], context);
    if (unknown.length) warnings.push(`Unknown class numbers: ${unknown.join(", ")}.`);
    if (uncertain.length) warnings.push(`TBA or unparseable meeting times require manual review: ${uncertain.join(", ")}.`);
    return {
      data: { valid: !unknown.length && !conflicts.length && !unavailable.length, sections, conflicts, unavailableClassNumbers: unavailable, unknownClassNumbers: unknown, warnings },
      warnings,
      summary: !unknown.length && !conflicts.length && !unavailable.length ? "The supplied sections have no confirmed time conflicts." : `Validation found ${conflicts.length} section conflicts, ${unavailable.length} unavailable-time conflicts, and ${unknown.length} unknown sections.`,
    };
  }

  private async buildAutonomousSchedule(args: { requiredCourseCodes: string[]; avoidDays: Array<"M" | "T" | "W" | "R" | "F" | "S" | "U">; minimumUnits: number; targetUnits: number; maxResults: number }, context: AgentRequest): Promise<ToolExecution> {
    const version = await this.catalogVersion(context);
    if (!version) throw new Error("Catalog version is unavailable");
    const [courseVersions, sectionRecords, lockedRecords] = await Promise.all([
      this.prisma.courseVersion.findMany({
        where: { catalogVersionId: version.id, programRequirements: { some: { itemType: "COURSE" } } },
        select: {
          courseId: true,
          units: true,
          course: { select: { code: true } },
          programRequirements: { select: { recommendedSemester: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
          prerequisiteRules: {
            select: { groupKey: true, operator: true, minimumGrade: true, isCorequisite: true, requiresManualReview: true, requiredCourse: { select: { id: true, code: true } } },
            orderBy: [{ groupKey: "asc" }, { requiredCourse: { code: "asc" } }],
          },
        },
      }),
      this.sectionRecords(context),
      this.sectionRecords(context, { classNumbers: context.selectedClassNumbers }),
    ]);
    const mappedSections = sectionRecords.map((record) => this.mapSection(record));
    const downstream = new Map<string, number>();
    for (const versionRecord of courseVersions) for (const rule of versionRecord.prerequisiteRules) downstream.set(rule.requiredCourse.id, (downstream.get(rule.requiredCourse.id) ?? 0) + 1);
    const planned = new Map(context.planEntries.map((entry) => [entry.courseId, entry.semester]));
    const courses: AutonomousCourse[] = courseVersions.map((course) => ({
      courseId: course.courseId,
      courseCode: course.course.code,
      units: course.units,
      roadmapSemester: course.programRequirements.find((requirement) => requirement.recommendedSemester !== null)?.recommendedSemester ?? 99,
      plannerSemester: planned.get(course.courseId),
      downstreamUnlocks: downstream.get(course.courseId) ?? 0,
      rules: course.prerequisiteRules,
      sections: mappedSections.filter((section) => section.courseId === course.courseId),
    }));
    const result = buildAutonomousSchedule({
      courses,
      completedCourseIds: context.completedCourseIds,
      lockedSections: lockedRecords.map((record) => this.mapSection(record)),
      unavailableTimes: context.unavailableTimes,
      avoidDays: args.avoidDays,
      requiredCourseCodes: args.requiredCourseCodes,
      minimumUnits: args.minimumUnits,
      targetUnits: args.targetUnits,
      maxResults: args.maxResults,
      maxCombinations: Math.min(25_000, Math.max(100, Number(process.env.AGENT_MAX_COMBINATIONS ?? "5000") || 5_000)),
      assumedNewStudent: context.completedCourseIds.length === 0 && context.planEntries.length === 0,
    });
    const unknownLocks = context.selectedClassNumbers.filter((classNumber) => !lockedRecords.some((record) => record.classNumber === classNumber));
    const warnings = [...result.warnings];
    if (unknownLocks.length) warnings.push(`Locked class numbers are not in ${context.termId}: ${unknownLocks.join(", ")}. They were not silently replaced.`);
    const data = { candidateCount: result.proposals.length, proposals: result.proposals, decisionTrace: result.trace, warnings };
    return {
      data,
      proposals: result.proposals,
      warnings,
      decisionTrace: result.trace,
      summary: result.proposals.length
        ? `Built ${result.proposals.length} autonomous schedule option${result.proposals.length === 1 ? "" : "s"}; examined ${result.trace.examinedCombinations} bounded combinations.`
        : `No schedule could satisfy the hard locks and verified catalog constraints after ${result.trace.examinedCombinations} bounded combinations.`,
    };
  }
}
