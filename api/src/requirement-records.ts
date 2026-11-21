import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requirementName, universityRequirement } from "./graduation-requirements";

/** Read-only view over the code-checked requirement snapshot written by scripts/requirement_records.py. */

type Verification = { status: "extracted" | "code_checked" | "human_verified"; checked_at: string | null; checked_by: string | null };
type Source = { key: string; quote: string | null; url: string | null; document_date: string | null; retrieved_at: string | null; locator: string | null; verification: Verification };
type RecordCourse = { code: string; term_id: string | null; section_numbers: string[] | null; topic: string | null; condition_refs: string[]; source_refs: string[] };
type Rule = { key: string; kind: string; text: string; condition_refs: string[]; source_refs: string[];
  includes?: RecordCourse[]; exclusions?: RecordCourse[]; count?: number; units?: number; children?: Rule[] };
export type RequirementRecord = {
  record_revision: number; scope: "program" | "campus"; program: string | null; catalog_year: string; requirement_key: string; title: string;
  catalog_list_coverage: "complete" | "partial" | "open" | "unknown"; verification: Verification; needs_review?: boolean;
  review_conflicts?: { field: string; alternatives: { value: string; source_ref: string }[] }[];
  sources: Source[]; aliases: { text: string; kind: string; candidate_ids: string[]; source_refs: string[] }[];
  conditions: { key: string; text: string; source_refs: string[] }[];
  applicability: { pattern: "legacy" | "current" | "unspecified"; condition_refs: string[]; program_effects: { program: string; target_requirement_id: string | null; effect: string; text: string; source_refs: string[] }[] };
  rule: Rule;
};
export type CatalogCorrection = { title: string; text: string; removed: string[]; disableChoice: boolean };
type Snapshot = { catalogYear: string; revision: string; records: RequirementRecord[]; catalogCorrections: Record<string, { sourceUrl: string; sections: CatalogCorrection[] }> };

const DEFAULT_PATH = join(__dirname, "..", "prisma", "data", "requirements", "2026-2027", "checked.json");
let cached: Snapshot | null | undefined;

export function setRequirementSnapshot(snapshot: Snapshot | null | undefined) {
  cached = snapshot;
}

export function requirementSnapshot(): Snapshot | null {
  if (cached === undefined) {
    const path = process.env.REQUIREMENT_RECORDS_PATH || DEFAULT_PATH;
    cached = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Snapshot : null;
  }
  return cached ?? null;
}

/** Remove codes the shared parser proved came from exclusion clauses or unit summaries; the section text is kept as evidence. */
export function correctedSections<T extends { title?: string; text?: string; choice?: boolean; courses?: { code: string }[]; rows?: { courses?: { code: string }[] }[] }>(slug: string, sections: T[]): T[] {
  const fixes = requirementSnapshot()?.catalogCorrections?.[slug]?.sections ?? [];
  if (!fixes.length) return sections;
  return sections.map(section => {
    const fix = fixes.find(item => item.title === section.title && item.text === section.text);
    if (!fix) return section;
    const removed = new Set(fix.removed);
    return { ...section, choice: fix.disableChoice ? false : section.choice,
      courses: (section.courses ?? []).filter(course => !removed.has(course.code)),
      ...(section.rows ? { rows: section.rows.map(row => ({ ...row, courses: (row.courses ?? []).filter(course => !removed.has(course.code)) }))
        .filter(row => row.courses.length) } : {}) };
  });
}

const PUBLISHED = new Set(["code_checked", "human_verified"]);

export function recordId(record: RequirementRecord, catalogVersionId: string) {
  return record.scope === "campus" ? `sjsu:${record.catalog_year}:${record.requirement_key}` : `${catalogVersionId}:${record.requirement_key}`;
}

export function publishedRecords(slug: string, year: string) {
  return (requirementSnapshot()?.records ?? []).filter(record => PUBLISHED.has(record.verification.status) && record.catalog_year === year
    && (record.scope === "campus" || record.program === slug));
}

function names(record: RequirementRecord) {
  const plain = record.title.replace(/\s*\(\d+(?:\.\d+)?\s*units?\)\s*$/i, "").replace(/^\d+\.\s*/, "");
  return new Set([record.title, plain, record.requirement_key, ...record.aliases.filter(alias => alias.kind !== "ambiguous").map(alias => alias.text)]
    .map(value => requirementName(value)).filter(Boolean));
}

/** Exact ID, key, title or sourced alias. Several matches stay ambiguous rather than picking one. */
export function resolveRecord(slug: string, year: string, catalogVersionId: string, requested: string) {
  const records = publishedRecords(slug, year);
  const byId = records.filter(record => recordId(record, catalogVersionId) === requested);
  if (byId.length) return { records: byId };
  const wanted = requirementName(requested.replace(/^(?:the|my)\s+/i, ""));
  const program = records.filter(record => record.scope === "program" && names(record).has(wanted));
  if (program.length) return { records: program };
  return { records: records.filter(record => record.scope === "campus" && names(record).has(wanted)) };
}

function leaves(rule: Rule): Rule[] {
  return rule.children?.length ? rule.children.flatMap(leaves) : [rule];
}

const SOURCE_KIND = (url: string | null) => !url ? "unknown" : url.includes("catalog.sjsu.edu") ? "catalog_program" : "official_page";

export function sourceView(source: Source) {
  return { kind: source.key.startsWith("department-") ? "department_list" : SOURCE_KIND(source.url),
    url: source.url, quote: source.quote, locator: source.locator,
    documentDate: source.document_date, checkedOn: source.retrieved_at?.slice(0, 10) ?? null, retrievedAt: source.retrieved_at };
}

/** Assistant listing built only from the record; membership claims carry the record's own evidence. */
export function recordListing(record: RequirementRecord, catalogVersionId: string,
  planner: Map<string, { id: string; title: string; units?: number | null }>) {
  const sources = new Map(record.sources.map(source => [source.key, source]));
  const conditions = new Map(record.conditions.map(condition => [condition.key, condition.text]));
  const parts = leaves(record.rule);
  const byCode = new Map<string, { code: string; courseId: string | null; title: string; units: number | null; inPlannerCatalog: boolean; groups: string[];
    rules: { sections: string[] | null; term: string | null; topic: string | null; condition: string | null; source: ReturnType<typeof sourceView> }[] }>();
  for (const leaf of parts) {
    for (const course of leaf.includes ?? []) {
      const known = planner.get(course.code);
      const entry = byCode.get(course.code) ?? { code: course.code, courseId: known?.id ?? null, title: known?.title ?? "",
        units: known?.units ?? null, inPlannerCatalog: Boolean(known), groups: [], rules: [] };
      if (!entry.groups.includes(leaf.key)) entry.groups.push(leaf.key);
      const source = sources.get(course.source_refs[0]);
      entry.rules.push({ sections: course.section_numbers, term: course.term_id, topic: course.topic,
        condition: course.condition_refs.map(key => conditions.get(key)).filter(Boolean).join(" ") || null,
        source: source ? sourceView(source) : sourceView({ key: "", quote: null, url: null, document_date: null, retrieved_at: null, locator: null, verification: record.verification }) });
      byCode.set(course.code, entry);
    }
  }
  const courses = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  const excludedCodes = [...new Set(parts.flatMap(leaf => (leaf.exclusions ?? []).map(course => course.code)))];
  const conflicts = (record.review_conflicts ?? []).map(conflict => ({ field: conflict.field, alternatives: conflict.alternatives.map(item => {
    const source = sources.get(item.source_ref);
    return { value: item.value, ...(source ? sourceView(source) : {}) };
  }) }));
  const coverage = record.catalog_list_coverage === "complete" ? null : record.catalog_list_coverage;
  const status = record.needs_review ? "source_conflict" : !courses.length ? "open_rule" : coverage ? "partial" : "verified";
  const school = record.scope === "campus" ? [record.title, ...record.aliases.map(alias => alias.text)]
    .map(value => universityRequirement(value.replace(/^Legacy\s+/i, "").replace(/\s+-\s+.*$/, "")))
    .find(item => item && "attributes" in item) : null;
  return {
    requirement: record.requirement_key, requirementId: recordId(record, catalogVersionId), label: record.title, scope: record.scope,
    status, verificationStatus: record.verification.status, checkedAt: record.verification.checked_at, recordRevision: record.record_revision,
    coverage, courses, excludedCodes, conflicts,
    ...(school && "attributes" in school ? { attributes: school.attributes } : {}),
    rule: { kind: record.rule.kind, text: record.rule.text, count: record.rule.count ?? null, units: record.rule.units ?? null,
      manualReview: parts.some(leaf => leaf.kind === "approval_required") || Boolean(record.needs_review),
      conditions: record.conditions.filter(condition => condition.key !== "designation-membership").map(condition => condition.text),
      groups: parts.map(leaf => ({ key: leaf.key, kind: leaf.kind, text: leaf.text, count: leaf.count ?? null, units: leaf.units ?? null,
        codes: (leaf.includes ?? []).map(course => course.code), excludedCodes: (leaf.exclusions ?? []).map(course => course.code) })) },
    applicability: { pattern: record.applicability.pattern,
      conditions: record.applicability.condition_refs.map(key => conditions.get(key)).filter(Boolean),
      programEffects: record.applicability.program_effects.map(effect => ({ effect: effect.effect, target: effect.target_requirement_id, text: effect.text })) },
    aliases: record.aliases.map(alias => ({ text: alias.text, kind: alias.kind })),
    sources: record.sources.map(sourceView),
  };
}
