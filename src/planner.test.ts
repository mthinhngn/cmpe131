import { describe, expect, it } from "vitest";
import { evaluatePrerequisites, findScheduleConflicts, parseStoredPlan } from "./planner";
import type { Course, Section } from "./types";

const course: Course = {
  id: "cmpe131",
  code: "CMPE 131",
  title: "Software Engineering I",
  units: 3,
  description: "",
  recommendedSemester: 5,
  prerequisiteCourseIds: ["cs146", "cs151"],
  sourceUrl: "https://example.com",
};

const section = (id: string, days: string[], startTime: string | null, endTime: string | null): Section => ({
  id,
  courseId: id,
  term: "Fall 2026",
  sectionNumber: id,
  instructor: null,
  meetings: [{ days, startTime, endTime, location: null }],
  availability: "unknown",
  openSeats: null,
  sourceUrl: "https://example.com",
});

describe("planning rules", () => {
  it("reports every missing prerequisite", () => {
    expect(evaluatePrerequisites(course, ["cs146"])).toEqual({ courseId: "cmpe131", status: "unmet", missingCourseIds: ["cs151"] });
  });

  it("accepts a course when all prerequisites are completed", () => {
    expect(evaluatePrerequisites(course, ["cs146", "cs151"]).status).toBe("met");
  });

  it("detects overlapping meetings but not adjacent meetings or TBA", () => {
    const conflicts = findScheduleConflicts([
      section("a", ["Mon"], "9:00 AM", "10:15 AM"),
      section("b", ["Mon", "Wed"], "10:00 AM", "11:00 AM"),
      section("c", ["Mon"], "10:15 AM", "11:15 AM"),
      section("d", ["Mon"], null, null),
    ]);
    expect(conflicts).toEqual([{ firstSectionId: "a", secondSectionId: "b", day: "Mon" }, { firstSectionId: "b", secondSectionId: "c", day: "Mon" }]);
  });

  it("rejects invalid imported JSON without mutating the current plan shape", () => {
    const parsed = parseStoredPlan('{"schemaVersion":2}', "Software Engineering", "Fall 2023 chart");
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.completedCourseIds).toEqual([]);
  });
});
