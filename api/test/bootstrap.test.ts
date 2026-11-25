import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BootstrapController } from "../src/bootstrap.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

function controller() {
  const prisma = {
    $queryRaw: async () => ["CMPE 30", "CMPE 132", "CS 156", "MUSC 10A"].map(code => ({
      id: code === "CMPE 30" ? "cmpe-30" : code, code, title: code, units: 3, unitsText: "3",
      description: null, prerequisiteText: null, sourceUrl: "https://www.sjsu.edu/",
    })),
    program: { findUnique: async ({ where }: { where: { slug: string } }) => !["computer-engineering", "software-engineering"].includes(where.slug) ? null : ({
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
    term: { findMany: async () => [{ id: "fall-2026" }], findUnique: async () => ({ id: "fall-2026", name: "Fall 2026", sourceUrl: "https://www.sjsu.edu/classes/", fetchedAt: new Date("2026-09-09"), sections: [
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
  await assert.rejects(() => controller().bootstrap("unknown-program"), /Requested program catalog was not found/);
});

test("backend elective filters and metadata agree, differ by major, and preserve core categories", async () => {
  const api = controller();
  for (const [program, technical] of [["computer-engineering", "CMPE 132"], ["software-engineering", "CS 156"]]) {
    const all = (await api.bootstrap(program)).catalog.courses;
    assert.equal(all.filter(course => course.code === "CMPE 30").length, 1);
    assert.equal(all.find(course => course.code === "CMPE 30")!.plannerCategory, "major");
    const filtered = (await api.bootstrap(program, "technical")).catalog.courses;
    assert.deepEqual(filtered.map(course => course.code), [technical]);
    for (const category of ["technical", "university"]) {
      assert.deepEqual((await api.bootstrap(program, category)).catalog.courses, all.filter(course => course.plannerCategory === category));
    }
  }
  await assert.rejects(() => api.bootstrap("computer-engineering", "invented"), /Unknown course category/);
});

test("combined programs remap shared courses, keep choices and assign added-course semesters", async () => {
  const api = controller();
  const base = (await api.bootstrap()).catalog;
  const minorCourse = { ...base.courses[0], id: "minor-alias", code: "MUSC 10A", recommendedSemester: 1 };
  const minor = { ...base, name: "Music Minor", selectedPrograms: [{ slug: "music-minor", title: "Music Minor", kind: "minor", sourceUrl: "https://catalog.sjsu.edu/" }],
    courses: [minorCourse, base.courses[0]], requirementGroups: [{ id: "semester-1", title: "Semester 1", description: "Minor requirements", items: [
      { id: "minor-course", type: "course" as const, courseId: "minor-alias", recommendedSemester: 1 },
      { id: "shared-course", type: "course" as const, courseId: base.courses[0].id },
      { id: "choice", type: "placeholder" as const, label: "Choose 3 units" },
    ] }] };
  api.bootstrap = async (slug = "computer-engineering") => ({ catalog: slug === "music-minor" ? minor : base });
  const combined = await api.compose("computer-engineering", ["music-minor"]);
  assert.equal(combined.sequenceKind, "draft");
  assert.equal(combined.selectedPrograms!.length, 2);
  assert.equal(combined.requirementGroups.length, 2);
  assert.equal(combined.requirementGroups[1].items.length, 2, "shared named course appears once");
  const course = combined.courses.find(c => c.code === "MUSC 10A")!;
  assert.equal(course.id, "MUSC 10A", "uses primary workspace identity");
  assert.equal(course.recommendedSemester, 2);
  assert.equal(combined.roadmapCourseIds!.includes(course.id), true);
  assert.notEqual(course.plannerCategory, "university");
  for (const extras of [["music-minor", "music-minor"], ["computer-engineering"], ["software-engineering"]]) {
    await assert.rejects(() => api.compose("computer-engineering", extras));
  }
});
