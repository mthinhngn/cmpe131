import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BootstrapController } from "../src/bootstrap.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

function eligibility(code: string, restrictions = {}) {
  return { courseId: code, course: { code }, sectionNumbers: [], termId: "", topic: "", conditionText: "",
    sourceKind: "department_list", sourceUrl: "https://www.sjsu.edu/cmpe/", checkedOn: new Date("2026-11-19"), ...restrictions };
}

function controller(withChoices = false, withEligibility = true) {
  const prisma = {
    $queryRaw: async () => ["CMPE 30", "CMPE 132", "CS 156", "MUSC 10A"].map(code => ({
      id: code === "CMPE 30" ? "cmpe-30" : code, code, title: code, units: 3, unitsText: "3",
      description: null, prerequisiteText: null, sourceUrl: "https://www.sjsu.edu/",
    })),
    program: { findUnique: async ({ where }: { where: { slug: string } }) => !["computer-engineering", "software-engineering"].includes(where.slug) ? null : ({
      name: where.slug === "software-engineering" ? "Software Engineering" : "Computer Engineering",
      abbreviation: where.slug === "software-engineering" ? "BSSE" : "BSCMPE",
      catalogVersions: [{ id: "test-version", catalogYear: "2026-2027", dataVersion: "test", sourceUrl: "https://catalog.sjsu.edu/", lastVerifiedAt: new Date("2026-09-09"),
        programMetadata: !withEligibility ? { technicalCodes: ["CMPE 132"] } : withChoices ? { sections: [
          { title: "Science Electives (6 units)", choice: true, units: 6, text: "Choose two courses. Department approval is required.",
            courses: [{ code: "CMPE 132", title: "Choice A" }, { code: "CS 156", title: "Choice B" }] },
          { title: "Complete One Course From", choice: true, text: "Select one course.", courses: [{ code: "CMPE 132", title: "Choice A" }] },
          { title: "Complete One Course From", choice: true, text: "Select one course.", courses: [{ code: "CS 156", title: "Choice B" }] },
        ] } : null,
        courseEligibility: !withEligibility ? [] : where.slug === "computer-engineering" ? [
          eligibility("CMPE 30"), eligibility("CMPE 132"), eligibility("CMPE 133"),
          eligibility("CMPE 180", { sectionNumbers: ["02"], termId: "spring-2027", topic: "Approved project" }),
          eligibility("CMPE 180", { sectionNumbers: ["01"], sourceKind: "catalog_program", conditionText: "Department approval" }),
        ] : [eligibility("CS 156")],
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

test("backend elective filters follow the stored list by major and preserve core categories", async () => {
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

test("requirement list reuses Planner technical classification and keeps department-only and section-scoped entries", async () => {
  const result = await controller().requirements("computer-engineering");
  assert.equal(result.status, "verified");
  const byCode = new Map(result.courses.flatMap(c => "rules" in c ? [[c.code, c] as const] : []));
  assert.equal(byCode.get("CMPE 132")?.inPlannerCatalog, true);
  assert.deepEqual(byCode.get("CMPE 132")?.rules[0], {
    sections: null, term: null, topic: null, condition: null,
    source: { kind: "department_list", url: "https://www.sjsu.edu/cmpe/", checkedOn: "2026-11-19" },
  });
  assert.equal(byCode.get("CMPE 133")?.inPlannerCatalog, false);
  const rules = byCode.get("CMPE 180")?.rules;
  assert.deepEqual(rules?.map(rule => rule.sections), [["02"], ["01"]]);
  assert.equal(rules?.[0].topic, "Approved project");
  assert.equal(rules?.[0].term, "spring-2027");
  assert.equal(rules?.[1].condition, "Department approval");
  assert.equal(rules?.[1].source.kind, "catalog_program");
  assert.ok(!byCode.has("CMPE 30"), "required roadmap course is not an elective");
  assert.ok(!byCode.has("CS 156"), "another program's elective does not count");
  assert.ok(!byCode.has("CMPE 297"));
  assert.equal(result.courses.length, 3);
  assert.equal(result.requirementId, "test-version:technical-electives");
  assert.equal((await controller().requirements("computer-engineering", "not a requirement")).status, "unknown_requirement");
});

test("legacy technical electives remain visible in Planner without establishing verified membership", async () => {
  const api = controller(false, false);
  const requirements = await api.requirements("computer-engineering");
  assert.equal(requirements.status, "no_source");
  assert.deepEqual(requirements.courses, []);
  const { catalog } = await api.bootstrap("computer-engineering", "technical");
  assert.deepEqual(catalog.courses.map(course => course.code), ["CMPE 132"]);
});

test("campus requirement aliases resolve to the same ID and declare section-only evidence", async () => {
  const api = controller();
  for (const alias of ["GE E", "Area E", "GE Area E", "sjsu:2026-2027:ge-e"]) {
    const result = await api.requirements("computer-engineering", alias);
    assert.equal(result.requirementId, "sjsu:2026-2027:ge-e");
    assert.equal(result.status, "partial");
    assert.deepEqual(result.attributes, ["GE E"]);
  }
  for (const label of ["US1", "US2", "US3", "Upper-Division GE", "WID", "GWAR", "PE"]) {
    assert.equal((await api.requirements("computer-engineering", label)).status, "partial");
  }
  assert.equal((await api.requirements("computer-engineering", "American Institutions")).status, "ambiguous_requirement");
  assert.equal((await api.requirements("computer-engineering", "GE E", "2025-2026")).status, "catalog_unavailable");
});

test("required courses, conditional choices and open rules use stored catalog evidence", async () => {
  const api = controller(true);
  const planner = (await api.bootstrap("computer-engineering")).catalog;
  const required = await api.requirements("computer-engineering", "required courses");
  assert.deepEqual(required.courses.map(course => course.courseId), planner.roadmapCourseIds);
  const choice = await api.requirements("computer-engineering", "Science Electives");
  assert.equal(choice.status, "partial");
  assert.equal(choice.rule?.count, 2);
  assert.equal(choice.rule?.units, 6);
  assert.equal(choice.rule?.manualReview, true);
  assert.equal((await api.requirements("computer-engineering", "Elective")).status, "open_rule");
  const duplicate = await api.requirements("computer-engineering", "Complete One Course From");
  assert.equal(duplicate.status, "ambiguous_requirement");
  assert.equal(duplicate.candidates?.length, 2);
  const id = duplicate.candidates?.[0].id!;
  const resolved = await api.requirements("computer-engineering", id);
  assert.equal(resolved.requirementId, id);
  assert.deepEqual(resolved.courses.map(course => course.code), ["CMPE 132"]);
  const menu = await api.requirementMenu("computer-engineering");
  const technical = await api.requirements("computer-engineering");
  assert.ok(menu.requirements.some(item => item.id === id));
  assert.ok(menu.requirements.some(item => item.id === required.requirementId));
  assert.ok(menu.requirements.some(item => item.id === technical.requirementId));
  assert.deepEqual((await api.requirements("computer-engineering", technical.requirementId)).courses, technical.courses);
  assert.deepEqual((await api.requirementMenu("computer-engineering", "2025-2026")).requirements, []);
});
