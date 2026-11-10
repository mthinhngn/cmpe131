import { test } from "node:test";
import assert from "node:assert/strict";
import { universityCalendar, universityCourses, universitySections } from "../src/university.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

test("scheduling uses the saved verified calendar and rejects expired evidence", async () => {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  let evidence: any = { status: "verified", as_of: day, valid_until: day, current_term: { season: "fall", year: 2026 } };
  const db = { sharedAcademicCalendar: { findUnique: async () => ({ evidence }) } } as unknown as PrismaService;
  assert.deepEqual(await universityCalendar(db), evidence);
  evidence = { ...evidence, valid_until: "2000-01-01" };
  assert.equal(await universityCalendar(db), null);
});

test("university reads label missing catalog facts without inventing prerequisites", async () => {
  const db = { $queryRaw: async () => [{ id: "sjsu-bus1-20", code: "BUS1 20", title: "Accounting", units: null, unitsText: "1-3", description: null, prerequisiteText: null, sourceUrl: "https://www.sjsu.edu/" }] } as unknown as PrismaService;
  const [course] = await universityCourses(db);
  assert.equal(course.unitsText, "1-3");
  assert.equal(course.recommendedSemester, 0);
  assert.match(course.prerequisiteText!, /not yet retrieved/);
  assert.deepEqual(course.prerequisiteCourseIds, []);
});

test("course references never create self prerequisites or self corequisites", async () => {
  const db = { $queryRaw: async () => [{ id: "math30", code: "MATH 30", title: "Calculus", units: 3, unitsText: "3", prerequisiteText: "MATH 30 or placement", prerequisiteCodes: ["MATH 30"], corequisiteText: "MATH 30", corequisiteCodes: ["MATH 30"], sourceUrl: "https://catalog.sjsu.edu/" }] } as unknown as PrismaService;
  const [course] = await universityCourses(db);
  assert.deepEqual(course.prerequisiteCourseIds, []);
  assert.deepEqual(course.prerequisiteOptionCourseIds, []);
  assert.deepEqual(course.corequisiteCourseIds, []);
});

test("imported Winter sections retain unknown seats and require review when component is absent", async () => {
  const evidence = { courseCode: "INFO 200", classNumber: "12345", sectionNumber: "10", component: "", mode: "Fully Online", days: "TBA", times: "TBA", location: "ONLINE", dates: "", instructors: [], openSeats: null, mandatoryZoom: "See instructor", notes: "" };
  const db = { $queryRaw: async () => [{ evidence, fetchedAt: new Date("2026-11-05T00:00:00Z") }] } as unknown as PrismaService;
  const result = await universitySections(db, "winter-2027");
  assert.equal(result.status, "available");
  assert.equal(result.offerings[0].seatsKnown, false);
  assert.equal(result.offerings[0].scheduleReview, true);
  assert.match(result.offerings[0].notes!, /See instructor/);
  await assert.rejects(() => universitySections(db, "not-a-term"));
});
