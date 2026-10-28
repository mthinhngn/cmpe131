import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BootstrapController } from "../src/bootstrap.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

function controller() {
  const prisma = {
    program: { findUnique: async ({ where }: { where: { slug: string } }) => ({
      name: where.slug === "software-engineering" ? "Software Engineering" : "Computer Engineering",
      abbreviation: where.slug === "software-engineering" ? "BSSE" : "BSCMPE",
      catalogVersions: [{ catalogYear: "2026-2027", dataVersion: "test", sourceUrl: "https://catalog.sjsu.edu/", lastVerifiedAt: new Date("2026-09-09"),
        courseVersions: [{ id: "database-version-id", course: { id: "cmpe-30", code: "CMPE 30" }, courseId: "cmpe-30", title: "Programming", units: 4, description: "Course", prerequisiteText: "Recorded condition",
          prerequisiteRules: [{ requiredCourseId: "math-19", isCorequisite: false }, { requiredCourseId: "math-30", isCorequisite: true }] }],
        requirementGroups: [{ id: "database-group-id", key: "semester-1", title: "Semester 1", description: "Fall", requirements: [
          { id: "database-item-id", sourceKey: "programming", itemType: "COURSE", courseVersionId: "database-version-id", recommendedSemester: 1 },
          { id: "database-choice-id", sourceKey: "elective", itemType: "PLACEHOLDER", label: "Elective", description: "3 units" },
        ] }],
      }],
    }) },
    term: { findUnique: async () => ({ id: "fall-2026", name: "Fall 2026", sourceUrl: "https://www.sjsu.edu/classes/", fetchedAt: new Date("2026-09-09"), sections: [
      { course: { code: "CMPE 30" }, sectionNumber: "01", classNumber: "12345", component: "LEC", mode: "In Person", days: "MW", times: "9:00AM-10:00AM", location: "ENGR", dates: "Fall", openSeats: 0, instructors: ["Instructor"] },
    ] }) },
  };
  return new BootstrapController(prisma as unknown as PrismaService);
}

test("bootstrap preserves frontend keys, conditions, placeholders and closed sections", async () => {
  const { catalog } = await controller().bootstrap("computer-engineering");
  assert.equal(catalog.requirementGroups[0].id, "semester-1");
  assert.equal(catalog.requirementGroups[0].items[0].id, "programming");
  assert.equal(catalog.requirementGroups[0].items[1].type, "placeholder");
  assert.equal(catalog.requirementGroups[0].items[0].courseId, "cmpe-30");
  assert.deepEqual(catalog.courses[0].prerequisiteCourseIds, ["math-19"]);
  assert.deepEqual(catalog.courses[0].corequisiteCourseIds, ["math-30"]);
  assert.equal(catalog.offerings[0].openSeats, 0);
  assert.deepEqual(catalog.offerings[0].instructors, ["Instructor"]);
});

test("bootstrap selects the requested program", async () => {
  const { catalog } = await controller().bootstrap("software-engineering");
  assert.equal(catalog.name, "Software Engineering");
  assert.equal(catalog.abbreviation, "BSSE");
});

test("bootstrap rejects unsupported programs", async () => {
  await assert.rejects(() => controller().bootstrap("computer-science"), /Program not found/);
});
