import type { AgentSection, ScheduleDecisionTrace, ScheduleProposal, UnavailableWindow } from "./agent.schemas";
import { metricsFor, parseMeeting, sectionsConflict, unavailableConflict } from "./schedule-domain";

export type AutonomousRule = {
  groupKey: string;
  operator: "AND" | "OR";
  minimumGrade: string | null;
  isCorequisite: boolean;
  requiresManualReview: boolean;
  requiredCourse: { id: string; code: string };
};

export type AutonomousCourse = {
  courseId: string;
  courseCode: string;
  units: number;
  roadmapSemester: number;
  plannerSemester?: number;
  downstreamUnlocks: number;
  rules: AutonomousRule[];
  sections: AgentSection[];
};

type CourseBundle = { course: AutonomousCourse; sections: AgentSection[] };

function groupedRules(rules: AutonomousRule[]) {
  const groups = new Map<string, AutonomousRule[]>();
  for (const rule of rules) groups.set(rule.groupKey, [...(groups.get(rule.groupKey) ?? []), rule]);
  return groups;
}

function ordinaryPrerequisitesSatisfied(course: AutonomousCourse, completed: Set<string>) {
  for (const rules of groupedRules(course.rules).values()) {
    const satisfied = (rule: AutonomousRule) => rule.isCorequisite || completed.has(rule.requiredCourse.id);
    if ((rules[0]?.operator === "OR" ? rules.some(satisfied) : rules.every(satisfied)) === false) return false;
  }
  return true;
}

function corequisitesSatisfied(course: AutonomousCourse, completed: Set<string>, sameTerm: Set<string>) {
  for (const rules of groupedRules(course.rules).values()) {
    const satisfied = (rule: AutonomousRule) => completed.has(rule.requiredCourse.id)
      || (rule.isCorequisite && sameTerm.has(rule.requiredCourse.id));
    if ((rules[0]?.operator === "OR" ? rules.some(satisfied) : rules.every(satisfied)) === false) return false;
  }
  return true;
}

function warningForRules(course: AutonomousCourse) {
  const warnings: string[] = [];
  for (const rule of course.rules) {
    if (rule.minimumGrade) warnings.push(`${course.courseCode}: ${rule.requiredCourse.code} requires minimum grade ${rule.minimumGrade}; grades are not verified.`);
    if (rule.requiresManualReview) warnings.push(`${course.courseCode}: ${rule.requiredCourse.code} requires manual prerequisite review.`);
  }
  return warnings;
}

function bundlePenalty(sections: AgentSection[]) {
  const metrics = metricsFor(sections);
  const uncertain = sections.filter((section) => parseMeeting(section).status !== "scheduled").length;
  return uncertain * 1_000_000 + metrics.campusDays * 10_000 + metrics.gapMinutes;
}

function buildBundles(course: AutonomousCourse, unavailableTimes: UnavailableWindow[], avoidDays: string[], limit: number) {
  const open = course.sections.filter((section) => section.openSeats > 0
    && !unavailableConflict(section, unavailableTimes)
    && !parseMeeting(section).patterns.some((pattern) => pattern.days.some((day) => avoidDays.includes(day))));
  const components = [...new Set(course.sections.map((section) => section.component))].sort();
  if (!components.length) return { bundles: [] as CourseBundle[], reason: "No section is published for the target term." };
  const slots = components.map((component) => open.filter((section) => section.component === component));
  if (slots.some((slot) => !slot.length)) return { bundles: [] as CourseBundle[], reason: "No open, usable section exists for every required component." };
  const bundles: CourseBundle[] = [];
  let examined = 0;
  const visit = (index: number, selected: AgentSection[]) => {
    if (examined >= limit || bundles.length >= 50) return;
    if (index === slots.length) {
      bundles.push({ course, sections: selected.map((section) => ({ ...section, source: "new" as const })) });
      return;
    }
    for (const section of slots[index]) {
      examined += 1;
      if (selected.some((existing) => sectionsConflict(existing, section))) continue;
      visit(index + 1, [...selected, section]);
      if (examined >= limit || bundles.length >= 50) break;
    }
  };
  visit(0, []);
  return { bundles: bundles.sort((left, right) => bundlePenalty(left.sections) - bundlePenalty(right.sections)), reason: bundles.length ? "" : "Published components cannot be paired without a meeting conflict." };
}

export function buildAutonomousSchedule(input: {
  courses: AutonomousCourse[];
  completedCourseIds: string[];
  lockedSections: AgentSection[];
  unavailableTimes: UnavailableWindow[];
  avoidDays: string[];
  requiredCourseCodes: string[];
  minimumUnits: number;
  targetUnits: number;
  maxResults: number;
  maxCombinations: number;
  assumedNewStudent: boolean;
}): { proposals: ScheduleProposal[]; warnings: string[]; trace: ScheduleDecisionTrace } {
  const completed = new Set(input.completedCourseIds);
  const lockedCourseIds = new Set(input.lockedSections.map((section) => section.courseId));
  const locked = input.lockedSections.map((section) => ({ ...section, source: "locked" as const }));
  const rejected: ScheduleDecisionTrace["rejectedCourses"] = [];
  const requiredCodes = new Set(input.requiredCourseCodes.map((code) => code.toUpperCase().replace(/\s+/g, " ")));
  const candidates = input.courses
    .filter((course) => !completed.has(course.courseId) && !lockedCourseIds.has(course.courseId))
    .filter((course) => {
      if (ordinaryPrerequisitesSatisfied(course, completed)) return true;
      rejected.push({ courseId: course.courseId, courseCode: course.courseCode, reason: "Ordinary prerequisites are not complete." });
      return false;
    })
    .sort((left, right) => Number(requiredCodes.has(right.courseCode.toUpperCase())) - Number(requiredCodes.has(left.courseCode.toUpperCase()))
      || left.roadmapSemester - right.roadmapSemester
      || Number(left.plannerSemester === undefined) - Number(right.plannerSemester === undefined)
      || right.downstreamUnlocks - left.downstreamUnlocks
      || left.courseCode.localeCompare(right.courseCode));

  const bundleBudget = Math.max(100, Math.floor(input.maxCombinations / Math.max(1, candidates.length)));
  const withBundles: Array<{ course: AutonomousCourse; bundles: CourseBundle[] }> = [];
  for (const course of candidates) {
    const built = buildBundles(course, input.unavailableTimes, input.avoidDays, bundleBudget);
    if (!built.bundles.length) rejected.push({ courseId: course.courseId, courseCode: course.courseCode, reason: built.reason });
    else withBundles.push({ course, bundles: built.bundles });
  }

  const unitsByCourse = new Map(input.courses.map((course) => [course.courseId, course.units]));
  const lockedUnits = [...lockedCourseIds].reduce((sum, courseId) => sum + (unitsByCourse.get(courseId) ?? 0), 0);
  const lockedConflict = locked.some((section, index) => locked.slice(index + 1).some((other) => sectionsConflict(section, other)));
  const lockedUnavailable = locked.some((section) => unavailableConflict(section, input.unavailableTimes));
  const warnings: string[] = [];
  if (locked.some((section) => section.openSeats <= 0)) warnings.push("A locked existing section has zero seats in the snapshot. It was preserved because existing selections are hard locks.");
  if (lockedConflict) warnings.push("Locked existing sections conflict with each other. They were preserved, so no proposal can be confirmed conflict-free until the student edits them manually.");
  if (lockedUnavailable) warnings.push("A locked existing section overlaps an unavailable window. It was preserved because existing selections are hard locks.");
  if (input.assumedNewStudent) warnings.push("No completed courses or semester plan were supplied, so Course Radar assumed a new student and started from the first eligible roadmap semester.");

  const raw: Array<{ sections: AgentSection[]; courseIds: string[]; units: number; priority: number }> = [];
  let examined = 0;
  const visit = (index: number, sections: AgentSection[], selectedCourseIds: string[], units: number, priority: number) => {
    if (examined >= input.maxCombinations) return;
    examined += 1;
    if (index === withBundles.length || units >= input.targetUnits) {
      const sameTerm = new Set([...lockedCourseIds, ...selectedCourseIds]);
      const chosen = input.courses.filter((course) => sameTerm.has(course.courseId));
      if (chosen.every((course) => corequisitesSatisfied(course, completed, sameTerm))) raw.push({ sections, courseIds: selectedCourseIds, units, priority });
      return;
    }
    const item = withBundles[index];
    if (units + item.course.units <= input.targetUnits) {
      for (const bundle of item.bundles) {
        if (sections.some((existing) => bundle.sections.some((section) => sectionsConflict(existing, section)))) continue;
        visit(index + 1, [...sections, ...bundle.sections], [...selectedCourseIds, item.course.courseId], units + item.course.units, priority + index);
        if (examined >= input.maxCombinations) break;
      }
    }
    visit(index + 1, sections, selectedCourseIds, units, priority);
  };
  visit(0, locked, [], lockedUnits, 0);

  const distinct = new Map<string, typeof raw[number]>();
  for (const candidate of raw) distinct.set(candidate.sections.map((section) => section.classNumber).sort().join("|"), candidate);
  const ranked = [...distinct.values()].filter((candidate) => candidate.sections.length > 0).sort((left, right) => {
    const leftMetrics = metricsFor(left.sections); const rightMetrics = metricsFor(right.sections);
    const leftRequired = withBundles.filter((item) => requiredCodes.has(item.course.courseCode.toUpperCase()) && !left.courseIds.includes(item.course.courseId)).length;
    const rightRequired = withBundles.filter((item) => requiredCodes.has(item.course.courseCode.toUpperCase()) && !right.courseIds.includes(item.course.courseId)).length;
    return Number(left.units < input.minimumUnits) - Number(right.units < input.minimumUnits)
      || leftRequired - rightRequired
      || Math.abs(input.targetUnits - left.units) - Math.abs(input.targetUnits - right.units)
      || left.priority - right.priority
      || leftMetrics.campusDays - rightMetrics.campusDays
      || leftMetrics.gapMinutes - rightMetrics.gapMinutes;
  });

  const eligibleTrace = candidates.map(({ courseId, courseCode, units, roadmapSemester, downstreamUnlocks }) => ({ courseId, courseCode, units, roadmapSemester, downstreamUnlocks }));
  const baseTrace: ScheduleDecisionTrace = { assumedNewStudent: input.assumedNewStudent, targetUnits: input.targetUnits, minimumUnits: input.minimumUnits, lockedClassNumbers: locked.map((section) => section.classNumber), eligibleCourses: eligibleTrace, rejectedCourses: rejected, replacements: [], examinedCombinations: examined };
  const proposals = ranked.slice(0, input.maxResults).map((candidate, index) => {
    const selectedSet = new Set(candidate.courseIds);
    const firstOmitted = candidates.find((course) => !selectedSet.has(course.courseId) && !lockedCourseIds.has(course.courseId));
    const replacement = firstOmitted ? candidates.find((course) => selectedSet.has(course.courseId) && candidates.indexOf(course) > candidates.indexOf(firstOmitted)) : undefined;
    const replacements = firstOmitted && replacement ? [{ skippedCourseCode: firstOmitted.courseCode, chosenCourseCode: replacement.courseCode, reason: rejected.find((item) => item.courseId === firstOmitted.courseId)?.reason ?? "The higher-priority course could not fit without violating a hard constraint." }] : [];
    const sections = candidate.sections.map((section) => replacement?.courseId === section.courseId && section.source !== "locked" ? { ...section, source: "replacement" as const } : section);
    const courseWarnings = input.courses.filter((course) => lockedCourseIds.has(course.courseId) || selectedSet.has(course.courseId)).flatMap(warningForRules);
    const uncertain = sections.filter((section) => parseMeeting(section).status !== "scheduled");
    const proposalWarnings = [...warnings, ...courseWarnings];
    if (candidate.units < input.minimumUnits) proposalWarnings.push(`Only ${candidate.units} units could be scheduled under the current hard constraints; the target was ${input.minimumUnits}–${input.targetUnits} units.`);
    if (uncertain.length) proposalWarnings.push(`TBA or unparseable meeting times require manual review: ${uncertain.map((section) => section.classNumber).join(", ")}.`);
    for (const courseId of new Set(sections.map((section) => section.courseId))) if (new Set(sections.filter((section) => section.courseId === courseId).map((section) => section.component)).size > 1) proposalWarnings.push(`${sections.find((section) => section.courseId === courseId)?.courseCode ?? courseId} has multiple components; lecture/lab pairing is not verified and requires manual review.`);
    const metrics = { ...metricsFor(sections), totalUnits: candidate.units };
    const decisionTrace = { ...baseTrace, replacements };
    return { id: `autonomous-${index + 1}-${sections.map((section) => section.classNumber).join("-")}`, title: index === 0 ? "Recommended path" : `Alternative ${index}`, sections, warnings: [...new Set(proposalWarnings)], metrics, lockedClassNumbers: baseTrace.lockedClassNumbers, decisionTrace };
  });
  return { proposals, warnings, trace: proposals[0]?.decisionTrace ?? baseTrace };
}
