import type { CourseOffering } from "./types";

export const WEEKDAYS = ["M", "T", "W", "R", "F"] as const;
export type MeetingDay = "M" | "T" | "W" | "R" | "F" | "S" | "U";

export type MeetingPattern = {
  days: MeetingDay[];
  startMinute: number;
  endMinute: number;
};

export type ParsedMeeting = {
  status: "scheduled" | "unscheduled" | "unparseable";
  patterns: MeetingPattern[];
};

export type TimeConflict = {
  left: CourseOffering;
  right: CourseOffering;
  days: MeetingDay[];
  startMinute: number;
  endMinute: number;
};

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

export function parseMeeting(offering: CourseOffering): ParsedMeeting {
  const timeParts = splitSource(offering.times);
  const ranges = timeParts.flatMap((part) => {
    const match = part.match(TIME_RANGE);
    if (!match) return [];
    const startMinute = parseClock(match[1], match[2], match[3]);
    const endMinute = parseClock(match[4], match[5], match[6]);
    return endMinute > startMinute ? [{ startMinute, endMinute }] : [];
  });

  if (!ranges.length) return { status: "unscheduled", patterns: [] };

  const embeddedDayParts = timeParts.filter((part) => DAY_TOKEN.test(part.toUpperCase()));
  const sourceDayParts = embeddedDayParts.length ? embeddedDayParts : splitSource(offering.days);
  const dayGroups = sourceDayParts.map(parseDays).filter((days) => days.length);
  if (!dayGroups.length) return { status: "unparseable", patterns: [] };

  const patterns = ranges.map((range, index) => ({
    ...range,
    days: dayGroups[Math.min(index, dayGroups.length - 1)],
  }));

  return { status: "scheduled", patterns };
}

export function detectTimeConflicts(offerings: CourseOffering[]): TimeConflict[] {
  const parsed = offerings.map((offering) => ({ offering, meeting: parseMeeting(offering) }));
  const conflicts: TimeConflict[] = [];

  for (let leftIndex = 0; leftIndex < parsed.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < parsed.length; rightIndex += 1) {
      const left = parsed[leftIndex];
      const right = parsed[rightIndex];
      const overlappingDays = new Set<MeetingDay>();
      let overlapStart = Number.POSITIVE_INFINITY;
      let overlapEnd = Number.NEGATIVE_INFINITY;

      for (const leftPattern of left.meeting.patterns) {
        for (const rightPattern of right.meeting.patterns) {
          const days = leftPattern.days.filter((day) => rightPattern.days.includes(day));
          const startMinute = Math.max(leftPattern.startMinute, rightPattern.startMinute);
          const endMinute = Math.min(leftPattern.endMinute, rightPattern.endMinute);
          if (!days.length || startMinute >= endMinute) continue;
          days.forEach((day) => overlappingDays.add(day));
          overlapStart = Math.min(overlapStart, startMinute);
          overlapEnd = Math.max(overlapEnd, endMinute);
        }
      }

      if (overlappingDays.size) {
        conflicts.push({
          left: left.offering,
          right: right.offering,
          days: [...overlappingDays],
          startMinute: overlapStart,
          endMinute: overlapEnd,
        });
      }
    }
  }

  return conflicts;
}

export function formatMinute(minute: number) {
  const hour24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export const dayLabel = (day: MeetingDay) => ({
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
  S: "Saturday",
  U: "Sunday",
}[day]);
