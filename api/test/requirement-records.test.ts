import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BootstrapController } from "../src/bootstrap.controller";
import type { PrismaService } from "../src/prisma/prisma.service";
import { correctedSections, setRequirementSnapshot } from "../src/requirement-records";
import { requirementMatches } from "../src/requirement-choices";

const checked = { status: "code_checked", checked_at: "2026-11-20T00:00:00Z", checked_by: "test" } as const;
const source = (key: string, url = "https://catalog.sjsu.edu/preview_program.php?poid=1") => ({ key, quote: `${key} quote`, url,
  document_date: null, retrieved_at: "2026-11-08T14:23:30.686Z", sha256: "a".repeat(64), locator: key, verification: checked });
const course = (code: string, refs = ["catalog"], conditions: string[] = []) =>
  ({ code, term_id: null, section_numbers: null, topic: null, condition_refs: conditions, source_refs: refs });

function record(key: string, extra: Record<string, unknown> = {}) {
  return { schema_version: "1.0.0", record_revision: 1, scope: "program", program: "test-program", catalog_year: "2026-2027", requirement_key: key,
    title: key, catalog_list_coverage: "complete", coverage_source_refs: ["catalog"], verification: checked, sources: [source("catalog")],
    aliases: [], conditions: [], applicability: { pattern: "unspecified", condition_refs: [], program_effects: [] },
    rule: { key, kind: "choose_courses", count: 1, text: "Choose one.", condition_refs: [], source_refs: ["catalog"], includes: [course("TEST 1")], exclusions: [] }, ...extra };
}

const snapshot = {
  catalogYear: "2026-2027", revision: "test",
  catalogCorrections: { "test-program": { sourceUrl: "https://catalog.sjsu.edu/", sections: [
    { title: "Electives (6 units)", text: "Choose. Graduate courses except TEST 9 may substitute.", removed: ["TEST 9"], disableChoice: false },
    { title: "Summary of Degree Units", text: "Unit summary.", removed: ["TEST 8"], disableChoice: true },
  ] } },
  records: [
    record("campus-first", { scope: "campus", program: null, title: "Unrelated campus record listed first in the snapshot",
      rule: { key: "campus-first", kind: "open_rule", text: "Rule.", condition_refs: [], source_refs: ["catalog"], includes: [], exclusions: [] } }),
    record("electives", { title: "Electives (6 units)", catalog_list_coverage: "open",
      aliases: [{ text: "Program Electives", kind: "official", candidate_ids: [], source_refs: ["catalog"] }],
      conditions: [{ key: "approval", text: "Advisor approval is required for substitutions.", source_refs: ["catalog"] }],
      rule: { key: "electives", kind: "choose_units", units: 6, text: "Choose 6 units.", condition_refs: ["approval"], source_refs: ["catalog"],
        includes: [course("TEST 2"), course("TEST 3", ["catalog"], ["approval"])], exclusions: [course("TEST 9")] } }),
    record("open-electives", { catalog_list_coverage: "open",
      rule: { key: "open-electives", kind: "open_rule", text: "Any upper-division course.", condition_refs: [], source_refs: ["catalog"], includes: [], exclusions: [] } }),
    record("prep", { applicability: { pattern: "unspecified", condition_refs: [], program_effects: [
      { program: "test-program", target_requirement_id: "campus:sjsu:2026-2027:ge-area-3", effect: "covered_by_major", text: "3 units may be satisfied by major coursework: Area 3",
        condition_refs: [], source_refs: ["catalog"] }] } }),
    record("conflicted", { needs_review: true, sources: [source("catalog"), source("department", "https://www.sjsu.edu/dept/")],
      review_conflicts: [{ field: "minimum_gpa", alternatives: [{ value: "2.7", source_ref: "catalog" }, { value: "3.0", source_ref: "department" }] }] }),
    record("staged", { verification: { status: "extracted", checked_at: null, checked_by: null } }),
    record("elsewhere", { program: "other-program" }),
    record("ge-area-3", { scope: "campus", program: null, title: "GE Area 3 - Arts and Humanities",
      aliases: [{ text: "Area 3", kind: "official", candidate_ids: [], source_refs: ["catalog"] }, { text: "Area C", kind: "former", candidate_ids: [], source_refs: ["catalog"] }],
      rule: { key: "ge-area-3", kind: "open_rule", text: "Arts and Humanities.", condition_refs: [], source_refs: ["catalog"], includes: [], exclusions: [] } }),
    record("legacy-area-c", { scope: "campus", program: null, title: "Legacy GE Area C - Arts & Humanities",
      applicability: { pattern: "legacy", condition_refs: [], program_effects: [] },
      aliases: [{ text: "Area C", kind: "official", candidate_ids: [], source_refs: ["catalog"] }],
      rule: { key: "legacy-area-c", kind: "open_rule", text: "Nine units.", condition_refs: [], source_refs: ["catalog"], includes: [], exclusions: [] } }),
  ],
};

function controller() {
  const prisma = {
    $queryRaw: async () => [],
    program: { findUnique: async ({ where }: { where: { slug: string } }) => where.slug !== "test-program" ? null : ({
      name: "Test Program", abbreviation: "BST",
      catalogVersions: [{ id: "v1", catalogYear: "2026-2027", dataVersion: "t", sourceUrl: "https://catalog.sjsu.edu/", lastVerifiedAt: null,
        programMetadata: { sections: [
          { title: "Electives (6 units)", choice: true, units: 6, text: "Choose. Graduate courses except TEST 9 may substitute.", courses: [{ code: "TEST 2", title: "Two" }, { code: "TEST 9", title: "Nine" }] },
          { title: "Summary of Degree Units", choice: true, text: "Unit summary.", courses: [{ code: "TEST 8", title: "Eight" }] },
        ] },
        courseEligibility: [], courseVersions: [], requirementGroups: [{ id: "g", key: "semester-1", title: "S1", description: "", requirements: [
          { id: "slot", sourceKey: "slot", itemType: "PLACEHOLDER", label: "Electives (6 units)", description: "3 units" }] }],
      }],
    }) },
    term: { findMany: async () => [], findUnique: async () => null },
  };
  return new BootstrapController(prisma as unknown as PrismaService);
}

test.beforeEach(() => setRequirementSnapshot(snapshot as never));
test.after(() => setRequirementSnapshot(undefined));

test("catalog corrections remove exclusion and summary codes from Planner evidence only", () => {
  const sections = correctedSections("test-program", [
    { title: "Electives (6 units)", text: "Choose. Graduate courses except TEST 9 may substitute.", choice: true, courses: [{ code: "TEST 2" }, { code: "TEST 9" }] },
    { title: "Summary of Degree Units", text: "Unit summary.", choice: true, courses: [{ code: "TEST 8" }] },
    { title: "Electives (6 units)", text: "Different text is never rewritten.", choice: true, courses: [{ code: "TEST 9" }] },
  ]);
  assert.deepEqual(sections[0].courses?.map(c => c.code), ["TEST 2"]);
  assert.equal(sections[1].choice, false);
  assert.deepEqual(sections[2].courses?.map(c => c.code), ["TEST 9"]);
  assert.deepEqual(correctedSections("other-program", sections), sections);
});

test("Planner slot matching uses the corrected catalog list", async () => {
  const { catalog } = await controller().bootstrap("test-program");
  const slot = catalog.requirementGroups[0].items[0];
  const course = (code: string) => ({ id: code, code, title: code, units: 3, description: "" } as never);
  assert.equal(requirementMatches(course("TEST 2"), slot, catalog), true);
  assert.equal(requirementMatches(course("TEST 9"), slot, catalog), false);
  const menu = await controller().requirementMenu("test-program");
  assert.ok(!menu.requirements.some(row => row.label === "Summary of Degree Units"));
});

test("assistant menu lists checked records only, never staged records or other programs", async () => {
  const menu = await controller().requirementMenu("test-program", undefined, "assistant");
  const ids = menu.requirements.map(row => row.id);
  assert.deepEqual(ids, ["v1:electives", "v1:open-electives", "v1:prep", "v1:conflicted", "sjsu:2026-2027:campus-first", "sjsu:2026-2027:ge-area-3", "sjsu:2026-2027:legacy-area-c"]);
  assert.ok(menu.requirements.every(row => row.verificationStatus === "code_checked"));
  assert.deepEqual((await controller().requirementMenu("test-program", "2025-2026", "assistant")).requirements, []);
});

test("assistant listing carries record evidence, exclusions, conditions and coverage", async () => {
  const api = controller();
  for (const name of ["Electives", "program electives", "v1:electives", "electives"]) {
    const result = await api.requirements("test-program", name, undefined, "assistant");
    assert.equal(result.requirementId, "v1:electives", name);
  }
  const result = await api.requirements("test-program", "electives", undefined, "assistant") as any;
  assert.deepEqual(result.courses.map((c: any) => c.code), ["TEST 2", "TEST 3"]);
  assert.deepEqual(result.excludedCodes, ["TEST 9"]);
  assert.equal(result.status, "partial");
  assert.equal(result.coverage, "open");
  assert.equal(result.verificationStatus, "code_checked");
  assert.equal(result.courses[1].rules[0].condition, "Advisor approval is required for substitutions.");
  assert.equal(result.courses[0].rules[0].source.quote, "catalog quote");
  assert.equal(result.courses[0].rules[0].source.checkedOn, "2026-11-08");
});

test("open rules, conflicts and ambiguous names are explicit outcomes", async () => {
  const api = controller();
  const open = await api.requirements("test-program", "open-electives", undefined, "assistant") as any;
  assert.equal(open.status, "open_rule");
  assert.equal(open.rule.text, "Any upper-division course.");
  const conflict = await api.requirements("test-program", "conflicted", undefined, "assistant") as any;
  assert.equal(conflict.status, "source_conflict");
  assert.deepEqual(conflict.conflicts[0].alternatives.map((a: any) => [a.value, a.url]),
    [["2.7", "https://catalog.sjsu.edu/preview_program.php?poid=1"], ["3.0", "https://www.sjsu.edu/dept/"]]);
  const former = await api.requirements("test-program", "Area C", undefined, "assistant") as any;
  assert.equal(former.status, "ambiguous_requirement");
  assert.deepEqual(former.candidates.map((c: any) => c.pattern), ["unspecified", "legacy"]);
  const campus = await api.requirements("test-program", "Area 3", undefined, "assistant") as any;
  assert.equal(campus.requirementId, "sjsu:2026-2027:ge-area-3");
  assert.deepEqual(campus.attributes, ["GE 3"]);
  assert.deepEqual(campus.majorEffects.map((e: any) => [e.effect, e.requirementId, e.source.url]),
    [["covered_by_major", "v1:prep", "https://catalog.sjsu.edu/preview_program.php?poid=1"]]);
  assert.equal((await api.requirements("test-program", "staged", undefined, "assistant")).status, "unknown_requirement");
});
