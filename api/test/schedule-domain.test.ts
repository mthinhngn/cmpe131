import assert from "node:assert/strict";
import test from "node:test";
import type { AgentSection } from "../src/agent/agent.schemas";
import { evaluatePrerequisiteWarnings } from "../src/agent/prerequisite-domain";
import { generateScheduleCandidates, sectionsConflict, unavailableConflict } from "../src/agent/schedule-domain";
import { buildAutonomousSchedule, type AutonomousCourse } from "../src/agent/autonomous-schedule-domain";

const section = (overrides: Partial<AgentSection> & Pick<AgentSection, "courseId" | "courseCode" | "classNumber">): AgentSection => ({
  courseId: overrides.courseId,
  courseCode: overrides.courseCode,
  classNumber: overrides.classNumber,
  sectionNumber: "01",
  mode: "In Person",
  component: "LEC",
  days: "M",
  times: "9:00AM - 10:00AM",
  location: "ENGR 101",
  dates: "08/19/2026 - 12/07/2026",
  openSeats: 5,
  instructors: ["Instructor"],
  ...overrides,
});

test("unavailable windows detect containment in either direction", () => {
  const meeting = section({ courseId: "a", courseCode: "A 1", classNumber: "1", times: "10:00AM - 11:00AM" });
  assert.equal(unavailableConflict(meeting, [{ day: "M", startMinute: 9 * 60, endMinute: 12 * 60 }]), true);
  assert.equal(unavailableConflict(section({ ...meeting, classNumber: "2", times: "8:00AM - 1:00PM" }), [{ day: "M", startMinute: 9 * 60, endMinute: 10 * 60 }]), true);
});

test("direct meeting containment is a conflict", () => {
  const outer = section({ courseId: "a", courseCode: "A 1", classNumber: "1", times: "9:00AM - 12:00PM" });
  const inner = section({ courseId: "b", courseCode: "B 1", classNumber: "2", times: "10:00AM - 11:00AM" });
  assert.equal(sectionsConflict(outer, inner), true);
});

test("TBA meetings remain candidates with a warning", () => {
  const proposals = generateScheduleCandidates({ sections: [section({ courseId: "a", courseCode: "A 1", classNumber: "1", days: "TBA", times: "TBA" })], courseIds: ["a"], unavailableTimes: [], maxResults: 3, maxCombinations: 100 });
  assert.equal(proposals.length, 1);
  assert.match(proposals[0].warnings.join(" "), /TBA or unparseable/);
});

test("ranking prefers open seats, then fewer campus days and gaps", () => {
  const proposals = generateScheduleCandidates({
    sections: [
      section({ courseId: "a", courseCode: "A 1", classNumber: "a-open", days: "M", times: "9:00AM - 10:00AM", openSeats: 3 }),
      section({ courseId: "a", courseCode: "A 1", classNumber: "a-closed", days: "T", times: "9:00AM - 10:00AM", openSeats: 0 }),
      section({ courseId: "b", courseCode: "B 1", classNumber: "b-mon", days: "M", times: "10:00AM - 11:00AM" }),
      section({ courseId: "b", courseCode: "B 1", classNumber: "b-wed", days: "W", times: "10:00AM - 11:00AM" }),
    ],
    courseIds: ["a", "b"], unavailableTimes: [], maxResults: 3, maxCombinations: 100,
  });
  assert.deepEqual(proposals[0].sections.map((item) => item.classNumber), ["a-open", "b-mon"]);
});

test("impossible schedules return no candidate", () => {
  const proposals = generateScheduleCandidates({ sections: [
    section({ courseId: "a", courseCode: "A 1", classNumber: "1", times: "9:00AM - 11:00AM" }),
    section({ courseId: "b", courseCode: "B 1", classNumber: "2", times: "10:00AM - 12:00PM" }),
  ], courseIds: ["a", "b"], unavailableTimes: [], maxResults: 3, maxCombinations: 100 });
  assert.equal(proposals.length, 0);
});

test("multi-component courses include a manual-pairing warning", () => {
  const proposals = generateScheduleCandidates({ sections: [
    section({ courseId: "a", courseCode: "A 1", classNumber: "1", component: "LEC", times: "9:00AM - 10:00AM" }),
    section({ courseId: "a", courseCode: "A 1", classNumber: "2", component: "LAB", times: "10:00AM - 11:00AM" }),
  ], courseIds: ["a"], unavailableTimes: [], maxResults: 3, maxCombinations: 100 });
  assert.match(proposals[0].warnings.join(" "), /pairing is not verified/);
});

test("prerequisite groups respect AND, OR, corequisites, grade and manual warnings", () => {
  const rules = [
    { groupKey: "choice", operator: "OR" as const, minimumGrade: null, isCorequisite: false, requiresManualReview: false, requiredCourse: { id: "p1", code: "P 1" } },
    { groupKey: "choice", operator: "OR" as const, minimumGrade: null, isCorequisite: false, requiresManualReview: false, requiredCourse: { id: "p2", code: "P 2" } },
    { groupKey: "coreq", operator: "AND" as const, minimumGrade: null, isCorequisite: true, requiresManualReview: false, requiredCourse: { id: "c1", code: "C 1" } },
    { groupKey: "required", operator: "AND" as const, minimumGrade: "C-", isCorequisite: false, requiresManualReview: true, requiredCourse: { id: "p3", code: "P 3" } },
  ];
  const warnings = evaluatePrerequisiteWarnings([{ courseId: "target", courseCode: "T 1", rules }], ["p2"], ["target", "c1"]);
  assert.equal(warnings.some((warning) => warning.includes("group choice")), false);
  assert.equal(warnings.some((warning) => warning.includes("group coreq")), false);
  assert.equal(warnings.some((warning) => warning.includes("group required")), true);
  assert.equal(warnings.some((warning) => warning.includes("minimum grade C-")), true);
  assert.equal(warnings.some((warning) => warning.includes("manual prerequisite review")), true);
});

const autonomousCourse = (overrides: Partial<AutonomousCourse> & Pick<AutonomousCourse, "courseId" | "courseCode">): AutonomousCourse => ({
  courseId: overrides.courseId,
  courseCode: overrides.courseCode,
  units: 3,
  roadmapSemester: 1,
  downstreamUnlocks: 0,
  rules: [],
  sections: [],
  ...overrides,
});

test("autonomous scheduling works without a semester plan and swaps to another eligible course", () => {
  const courses = [
    autonomousCourse({ courseId: "a", courseCode: "A 1", downstreamUnlocks: 2, sections: [section({ courseId: "a", courseCode: "A 1", classNumber: "a-closed", openSeats: 0 })] }),
    autonomousCourse({ courseId: "b", courseCode: "B 1", sections: [section({ courseId: "b", courseCode: "B 1", classNumber: "b-open", openSeats: 4 })] }),
  ];
  const result = buildAutonomousSchedule({ courses, completedCourseIds: [], lockedSections: [], unavailableTimes: [], avoidDays: [], requiredCourseCodes: [], minimumUnits: 3, targetUnits: 3, maxResults: 3, maxCombinations: 100, assumedNewStudent: true });
  assert.deepEqual(result.proposals[0].sections.map((item) => item.classNumber), ["b-open"]);
  assert.equal(result.proposals[0].sections[0].source, "replacement");
  assert.equal(result.trace.assumedNewStudent, true);
  assert.match(result.trace.rejectedCourses.find((item) => item.courseId === "a")?.reason ?? "", /No open/);
});

test("autonomous scheduling excludes courses with incomplete ordinary prerequisites", () => {
  const blocked = autonomousCourse({ courseId: "advanced", courseCode: "ADV 2", rules: [{ groupKey: "default", operator: "AND", minimumGrade: null, isCorequisite: false, requiresManualReview: false, requiredCourse: { id: "intro", code: "INTRO 1" } }], sections: [section({ courseId: "advanced", courseCode: "ADV 2", classNumber: "advanced-open" })] });
  const result = buildAutonomousSchedule({ courses: [blocked], completedCourseIds: [], lockedSections: [], unavailableTimes: [], avoidDays: [], requiredCourseCodes: [], minimumUnits: 3, targetUnits: 3, maxResults: 3, maxCombinations: 100, assumedNewStudent: false });
  assert.equal(result.proposals.length, 0);
  assert.match(result.trace.rejectedCourses[0].reason, /prerequisites/);
});

test("autonomous scheduling preserves a closed locked section and never adds a closed section", () => {
  const locked = section({ courseId: "a", courseCode: "A 1", classNumber: "a-locked", openSeats: 0 });
  const course = autonomousCourse({ courseId: "a", courseCode: "A 1", sections: [locked] });
  const result = buildAutonomousSchedule({ courses: [course], completedCourseIds: [], lockedSections: [locked], unavailableTimes: [], avoidDays: [], requiredCourseCodes: [], minimumUnits: 3, targetUnits: 3, maxResults: 3, maxCombinations: 100, assumedNewStudent: false });
  assert.equal(result.proposals[0].sections[0].source, "locked");
  assert.match(result.proposals[0].warnings.join(" "), /zero seats/);
});
