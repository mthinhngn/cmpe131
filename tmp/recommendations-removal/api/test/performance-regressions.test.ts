import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { AgentToolsService } from "../src/agent/agent-tools.service";
import { findConflicts, generateScheduleCandidates } from "../src/agent/schedule-domain";
import type { AgentRequest, AgentSection } from "../src/agent/agent.schemas";
import type { PrismaService } from "../src/prisma/prisma.service";

const section = (classNumber: string): AgentSection => ({ courseId: classNumber, courseCode: `TEST ${classNumber}`, classNumber, sectionNumber: "01", component: "LEC", days: "M", times: "9:00AM-10:00AM", openSeats: 5, dates: "Fall", location: "ENGR", mode: "In Person", instructors: [] });

test("meeting reuse stays local to a search and observes updated snapshot fields", () => {
  const sections = [section("1"), section("2")];
  const input = { sections, courseIds: ["1", "2"], unavailableTimes: [], maxResults: 3, maxCombinations: 100 };
  assert.equal(generateScheduleCandidates(input).length, 0);
  assert.deepEqual(findConflicts(sections), [{ left: "1", right: "2" }]);
  sections[1].times = "10:00AM-11:00AM";
  assert.equal(generateScheduleCandidates(input).length, 1);
  assert.deepEqual(findConflicts(sections), []);
  sections[1].times = "TBA";
  sections[1].days = "TBA";
  assert.match(generateScheduleCandidates(input)[0].warnings.join(" "), /TBA/);
});

test("autonomous tool reads sections once and retains closed and unknown lock warnings", async () => {
  let sectionQueries = 0;
  const locked = { ...section("locked"), course: { code: "TEST locked" }, openSeats: 0 };
  const prisma = {
    catalogVersion: { findFirst: async () => ({ id: "version" }) },
    courseVersion: { findMany: async () => [{ courseId: "locked", units: 3, course: { code: "TEST locked" }, programRequirements: [{ recommendedSemester: 1, sortOrder: 1 }], prerequisiteRules: [] }] },
    section: { findMany: async (query: { where: { termId: string } }) => {
      sectionQueries++;
      assert.equal(query.where.termId, "fall-2026");
      return [locked];
    } },
  };
  const context: AgentRequest = { message: "Build my schedule", history: [], program: "computer-engineering", catalogYear: "2026-2027", termId: "fall-2026", completedCourseIds: [], planEntries: [], selectedClassNumbers: ["locked", "unknown"], unavailableTimes: [], preferences: {} };
  const result = await new AgentToolsService(prisma as unknown as PrismaService).execute("build_autonomous_schedule", { requiredCourseCodes: [], avoidDays: [], minimumUnits: 3, targetUnits: 3, maxResults: 3 }, context);
  assert.equal(sectionQueries, 1);
  assert.deepEqual(result.proposals?.[0].sections.map(item => item.classNumber), ["locked"]);
  assert.match(result.warnings?.join(" ") ?? "", /zero seats/);
  assert.match(result.warnings?.join(" ") ?? "", /unknown/);
});
