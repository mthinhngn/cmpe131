import type { AgentSection, ScheduleProposal, UnavailableWindow } from "./agent.schemas";

export type MeetingDay = "M" | "T" | "W" | "R" | "F" | "S" | "U";
export type MeetingPattern = { days: MeetingDay[]; startMinute: number; endMinute: number };
export type ParsedMeeting = { status: "scheduled" | "unscheduled" | "unparseable"; patterns: MeetingPattern[] };

const TIME_RANGE = /^(\d{1,2}):(\d{2})(AM|PM)\s*-\s*(\d{1,2}):(\d{2})(AM|PM)$/i;
const DAY_TOKEN = /^[MTWRFSU]+$/;
const splitSource = (value: string) => value.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);

function parseClock(hourValue: string, minuteValue: string, meridiem: string) {
  let hour = Number(hourValue) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(minuteValue);
}

function parseDays(value: string): MeetingDay[] {
  const normalized = value.toUpperCase().replace(/\s+/g, "");
  if (!DAY_TOKEN.test(normalized)) return [];
  return [...new Set(normalized.split(""))] as MeetingDay[];
}

export function parseMeeting(section: Pick<AgentSection, "times" | "days">): ParsedMeeting {
  const timeParts = splitSource(section.times);
  const ranges = timeParts.flatMap((part) => {
    const match = part.match(TIME_RANGE);
    if (!match) return [];
    const startMinute = parseClock(match[1], match[2], match[3]);
    const endMinute = parseClock(match[4], match[5], match[6]);
    return endMinute > startMinute ? [{ startMinute, endMinute }] : [];
  });
  if (!ranges.length) return { status: "unscheduled", patterns: [] };

  const embeddedDays = timeParts.filter((part) => DAY_TOKEN.test(part.toUpperCase()));
  const dayGroups = (embeddedDays.length ? embeddedDays : splitSource(section.days))
    .map(parseDays).filter((days) => days.length);
  if (!dayGroups.length) return { status: "unparseable", patterns: [] };

  return {
    status: "scheduled",
    patterns: ranges.map((range, index) => ({
      ...range,
      days: dayGroups[Math.min(index, dayGroups.length - 1)],
    })),
  };
}

function patternsOverlap(left: MeetingPattern, right: MeetingPattern) {
  return left.days.some((day) => right.days.includes(day))
    && Math.max(left.startMinute, right.startMinute) < Math.min(left.endMinute, right.endMinute);
}

export function sectionsConflict(left: AgentSection, right: AgentSection) {
  const leftMeeting = parseMeeting(left);
  const rightMeeting = parseMeeting(right);
  return leftMeeting.patterns.some((leftPattern) => rightMeeting.patterns.some((rightPattern) => patternsOverlap(leftPattern, rightPattern)));
}

export function unavailableConflict(section: AgentSection, windows: UnavailableWindow[]) {
  const meeting = parseMeeting(section);
  return meeting.patterns.some((pattern) => windows.some((window) => pattern.days.includes(window.day)
    && Math.max(pattern.startMinute, window.startMinute) < Math.min(pattern.endMinute, window.endMinute)));
}

export function findConflicts(sections: AgentSection[]) {
  const conflicts: Array<{ left: string; right: string }> = [];
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      if (sectionsConflict(sections[left], sections[right])) {
        conflicts.push({ left: sections[left].classNumber, right: sections[right].classNumber });
      }
    }
  }
  return conflicts;
}

export function metricsFor(sections: AgentSection[]) {
  const dayPatterns = new Map<MeetingDay, Array<{ start: number; end: number }>>();
  for (const section of sections) {
    for (const pattern of parseMeeting(section).patterns) {
      for (const day of pattern.days) {
        dayPatterns.set(day, [...(dayPatterns.get(day) ?? []), { start: pattern.startMinute, end: pattern.endMinute }]);
      }
    }
  }
  let gapMinutes = 0;
  for (const patterns of dayPatterns.values()) {
    const sorted = [...patterns].sort((left, right) => left.start - right.start);
    for (let index = 1; index < sorted.length; index += 1) gapMinutes += Math.max(0, sorted[index].start - sorted[index - 1].end);
  }
  return {
    campusDays: dayPatterns.size,
    gapMinutes,
    closedSections: sections.filter((section) => section.openSeats <= 0).length,
  };
}

function preferencePenalty(sections: AgentSection[], earliestStartMinute?: number, latestEndMinute?: number) {
  let penalty = 0;
  for (const section of sections) {
    for (const pattern of parseMeeting(section).patterns) {
      if (earliestStartMinute !== undefined) penalty += Math.max(0, earliestStartMinute - pattern.startMinute);
      if (latestEndMinute !== undefined) penalty += Math.max(0, pattern.endMinute - latestEndMinute);
    }
  }
  return penalty;
}

export function generateScheduleCandidates(input: {
  sections: AgentSection[];
  courseIds: string[];
  unavailableTimes: UnavailableWindow[];
  earliestStartMinute?: number;
  latestEndMinute?: number;
  maxResults: number;
  maxCombinations: number;
}): ScheduleProposal[] {
  const slots: Array<{ courseId: string; component: string; options: AgentSection[] }> = [];
  for (const courseId of input.courseIds) {
    const courseSections = input.sections.filter((section) => section.courseId === courseId);
    const components = [...new Set(courseSections.map((section) => section.component))].sort();
    if (!components.length) return [];
    for (const component of components) {
      const options = courseSections
        .filter((section) => section.component === component && !unavailableConflict(section, input.unavailableTimes))
        .sort((left, right) => Number(right.openSeats > 0) - Number(left.openSeats > 0) || right.openSeats - left.openSeats);
      if (!options.length) return [];
      slots.push({ courseId, component, options });
    }
  }

  const candidates: AgentSection[][] = [];
  let examined = 0;
  const visit = (slotIndex: number, selected: AgentSection[]) => {
    if (examined >= input.maxCombinations) return;
    if (slotIndex === slots.length) {
      candidates.push([...selected]);
      return;
    }
    for (const option of slots[slotIndex].options) {
      examined += 1;
      if (examined > input.maxCombinations) break;
      if (selected.some((existing) => sectionsConflict(existing, option))) continue;
      selected.push(option);
      visit(slotIndex + 1, selected);
      selected.pop();
      if (examined >= input.maxCombinations) break;
    }
  };
  visit(0, []);

  const distinct = new Map<string, AgentSection[]>();
  for (const sections of candidates) distinct.set(sections.map((section) => section.classNumber).sort().join("|"), sections);
  return [...distinct.values()]
    .map((sections) => {
      const metrics = metricsFor(sections);
      const warnings: string[] = [];
      const uncertain = sections.filter((section) => parseMeeting(section).status !== "scheduled");
      if (uncertain.length) warnings.push(`Meeting times are TBA or unparseable for ${uncertain.map((section) => `${section.courseCode} ${section.component}`).join(", ")}; verify them manually.`);
      for (const courseId of input.courseIds) {
        const components = new Set(sections.filter((section) => section.courseId === courseId).map((section) => section.component));
        if (components.size > 1) warnings.push(`${sections.find((section) => section.courseId === courseId)?.courseCode ?? courseId} has multiple components; lecture/lab pairing is not verified and requires manual review.`);
      }
      return {
        sections,
        metrics,
        warnings,
        score: metrics.closedSections * 100_000 + metrics.campusDays * 10_000 + metrics.gapMinutes
          + preferencePenalty(sections, input.earliestStartMinute, input.latestEndMinute),
      };
    })
    .sort((left, right) => left.score - right.score)
    .slice(0, input.maxResults)
    .map((candidate, index) => ({
      id: `schedule-${index + 1}-${candidate.sections.map((section) => section.classNumber).join("-")}`,
      title: index === 0 ? "Best fit" : `Alternative ${index}`,
      sections: candidate.sections,
      warnings: candidate.warnings,
      metrics: candidate.metrics,
    }));
}
