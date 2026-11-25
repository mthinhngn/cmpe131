# Requirement record contract (CP2 design only)

Status: Phase B step 1 proposal for CP2 review, before extraction or implementation. CP1 approval is provided by the current task. This document and the accompanying [JSON Schema](schemas/requirement-record.schema.json) are the data-pipeline deliverables; the independent [agent design](REQUIREMENT_LOOKUP_AGENT_DESIGN.md) owns query/tool behavior. No official policy mapping is asserted here.

## Existing structures and boundary

Inspected `api/prisma/schema.prisma`, `api/src/graduation-requirements.ts`, `api/src/bootstrap.controller.ts`, `scripts/import_sjsu_programs.py`, and the requirement lookup handoff, phase 0–1/2/3, generalization and CP1 implementation documents. These are checkout observations, not freshly verified source policies or database state.

- `CatalogVersion` is unique by program/year and holds optional `programMetadata`. `RequirementGroup`/`ProgramRequirement` model roadmap groups and course/placeholder items, not a full requirement policy.
- `CatalogCourseEligibility` already supplies course identity, requirement key, source kind/URL, checked date, term, section numbers, topic and condition text. Its compound rule identity preserves multiple rules for one course. It lacks verbatim context, source hash, independent trust, closed-list coverage, exclusions and compound selection semantics.
- `UniversityCourseRecord` owns course facts; `UniversitySectionRecord` and `Term` own offerings and snapshot freshness. This contract duplicates neither units per course nor seats/instructors.
- `choiceRule` returns text/count/units/manual-review flags. `universityRequirement` recognizes campus labels. Neither regex output is proof of policy, an alias crosswalk, a complete list, or program applicability.
- The importer sets `CatalogVersion.lastVerifiedAt = now()` during ordinary catalog publication. That field is import timing, not human review; never map `catalog.lastVerifiedAt`, `dataStatus: reviewed`, successful import, or `SourceSnapshot.status` to `human_verified`. Existing CE/SE review provenance applies only to the reviewed source-bundle relationships.
- The importer's `sections()` merges descendant choice courses/text into a parent; `section_items()` emits roadmap items/placeholders. Reusing those flattened arrays as a closed requirement list would lose conjunctions and exclusions. Keep their source evidence as input for later review, not a certified record.
- **Current membership hazard:** `readCatalog()` restricts eligibility to technical electives and removes `degreeCodes` before returning it. The future assistant record reader must load the source records before that Planner duplicate-credit filter, for every requirement key. A source-listed course can be a membership match while remaining unavailable for duplicate Planner credit. Do not change the approved Planner projection or its classifications to achieve this.

These records are additive. Existing CE/SE reviewed source rows and IDs remain authoritative at their original scope. Preserve their existing `human_verified` provenance only on the exact source rows actually reviewed. Do not promote derived program records, aliases, waivers, merged rules or new quotes to human verification by association. Existing Planner parity boundaries remain unchanged; CP2 performs no parity run or runtime edit.

## Core fields and identity

One JSON document describes one real menu requirement for one catalog year, across any of the approved ten program slugs or campus scope. Slugs reuse `Program.slug`; the schema does not invent or expand the approved ten-program inventory. A syntactically valid slug must still resolve against that inventory at publication. Campus uses `scope: campus, program: null`; program uses `scope: program, program: <slug>`.

| Field | Contract |
| --- | --- |
| `schema_version` | Contract version `1.0.0`; strict properties catch misspellings. |
| `record_revision` | Positive revision within a stable identity, incremented only for changed content/evidence/review. |
| `catalog_year`, `requirement_key`, `title` | Exact year, curated stable key, source-backed display title. No key derived from array position or mutable heading occurrence. |
| `catalog_list_coverage` | `complete`, `partial`, `open`, `unknown`; independent of verification. |
| `coverage_source_refs` | Source passage keys establishing list scope/exhaustiveness; absence never means complete. |
| `verification` | `status`, actual `checked_at`, actual `checked_by` (validator/version or reviewer identity). |
| `sources[]` | `key`, `quote`, `url`, `document_date`, `retrieved_at`, `sha256`, `locator`, `verification`. |
| `aliases[]` | `text`, `kind`, `candidate_ids`, `source_refs`. |
| `conditions[]` | `key`, verbatim `text`, `source_refs`; opaque conditions, not an executable policy language. |
| `applicability` | `pattern`, `condition_refs`, `program_effects`; described below. |
| `rule` | The small rule structure below. |

Logical IDs are computed, not another mutable field: `program:<slug>:<catalog_year>:<requirement_key>` or `campus:sjsu:<catalog_year>:<requirement_key>`. Resolve these to existing catalog-version/group IDs through an adapter; never rename existing IDs. Preserve `technical-electives` and other established keys where their meaning matches. Existing occurrence-generated choice keys need a reviewed key/legacy-ID registry, not a silently changed public ID. Duplicate titles remain distinct keys and candidates.

Integration naming for the independent C design (concept names are not additional JSON fields):

| C concept | Exact v1 record field |
| --- | --- |
| `program`, `catalog_year`, `requirement_key` | Same top-level fields, with explicit `scope`. |
| `kind` | `rule.kind`, or a child node's `kind`. |
| `included_courses`, `excluded_courses` | Leaf `includes`, `exclusions`; groups have `children`, never a flattened list. |
| `conditions` | Top-level `conditions[]`, attached via `condition_refs` at the relevant scope. |
| `source_url`, `source_quote` | `sources[].url`, `sources[].quote`, joined via `source_refs`. |
| `status` | `verification.status`; source review has its own `sources[].verification.status`. |

Year selection belongs to C: explicit requested year first, then the persisted workspace year only when actually available, then a sole supported dataset year disclosed to the user. An unavailable explicit year must not silently fall back. Do not invent a workspace year. Ask about legacy/current applicability only when unresolved pattern/cohort conditions materially affect the answer; the label alone does not require clarification. Staging `extracted` records must never be published as checked membership.

A wording correction keeps the key. A different requirement meaning gets a new key and reviewed replacement mapping. A new catalog year gets a new identity; no automatic year rollover or policy inheritance. Schema-breaking changes require a new major version and explicit consumer adaptation. Strict v1 readers reject unsupported fields/versions; even additive field changes require a coordinated schema/consumer release. Identical payloads are idempotent; stable source/rule/condition keys survive heading reorder. Year adjacency and identity uniqueness require semantic checks.

## Rules without flattening

Every node has `key`, `kind`, source-backed `text`, `source_refs`, `condition_refs`. Leaves also have separate `includes[]` and `exclusions[]`:

| `kind` | Additional fields / meaning |
| --- | --- |
| `required_all` | All source-listed includes are required, subject to conditions. |
| `choose_courses` | Positive integer `count`; select that many courses from the stated scope. |
| `choose_units` | Positive numeric `units`; the source-stated total, never inferred course units. |
| `open_rule` | Preserve an unenumerated or not yet safely structured rule; an empty list is not a negative. |
| `approval_required` | Preserve approval wording; includes are candidates, not approval receipts. |
| `all_of` / `any_of` | Two or more `children`; only grouping operators, no numeric fields or course lists. |

`A AND (B OR C)` stays `all_of(A, any_of(B, C))`. A count plus a units threshold stays two conjunctive leaves. Do not union their lists and call it choose-one. Shared credit between children is not implied. This is five existing rule concepts plus two grouping operators, not a grade/range/waiver expression engine. Preserve unsupported logic as an `open_rule` with the original quote and explicit conditions; do not claim automatic satisfaction. A later consumer should reject unsafe evaluation rather than flatten deeper expressions.

Each course entry has `code`, `term_id`, `section_numbers`, `topic`, `condition_refs`, `source_refs`. Term, section, topic and conditions within one entry are conjunctive. Multiple entries for a code preserve alternative published eligibility paths. An exclusion applies within its leaf only; express a broader exclusion on each affected leaf with the same proof. Matching a positive entry never overrides an applicable exclusion. An unresolved exclusion/condition leaves membership conditional, not affirmed. Across groups, branch eligibility and satisfaction remain separate from a union of candidate courses.

`null` restriction fields mean no restriction was captured in that field, not evidence of all-term/all-topic approval. During promotion, contextual proof must establish whether the source is unrestricted in that dimension or the limitation must be retained in `conditions`. Preserve section numbers as strings, including leading zeroes. Course codes are identity strings, not evidence of units, level or cross-list equivalence. Missing course facts/IDs do not erase explicitly sourced membership.

Conditions attached to the record's applicability, a rule ancestor, the leaf and the matching course all apply conjunctively. A condition whose truth is unknown stays unknown. For conditional alternatives, attach the condition to the appropriate child and preserve each branch; there is no inferred ELSE branch, negation or default approval. Distinguish conditional rules from verified unqualified matches in C's response contract.

## Coverage, evidence and trust

`complete` means an explicitly closed catalog membership list for this requirement's exact year/program/conditions, with all branches and restrictions captured. It does not mean every university course or all requirements were captured. `partial` means a finite known subset with uncaptured possibilities. `open` means the source describes an open class of choices rather than a finite exhaustive list. `unknown` means available evidence cannot establish the list's extent. A compound record uses the conservative combined coverage: only all closed branches can be complete; a mixture of finite and open scopes cannot become a complete enumerated list. A rule kind and coverage are separate: a staged `required_all` can have unknown coverage.

Neither `code_checked` nor `human_verified` implies complete. `complete + []` is a supported zero only if the source explicitly establishes that empty scope. `unknown + []` is a missing list. A missing record is missing evidence, not a record asserting no requirement. Section tags establish section scope only and cannot certify a complete catalog list. Health counts such as 521 programs establish neither per-program coverage nor catalog-wide completeness.

`sources[].quote` is verbatim, including surrounding logic/footnotes needed to distinguish includes, exclusions, alternatives, conditions and counts. `url` is the exact official HTTPS URL (host `sjsu.edu` or its subdomain); syntax alone does not verify authority. `locator` identifies heading/anchor/page and passage within that capture. `sha256` hashes the original captured document bytes, not a reserialized quote. `retrieved_at` is the recorded retrieval timestamp; `document_date` is a separately published date, or null when unpublished/unknown. No current time, filesystem modification time, old `checkedOn`, or recomputed synthetic timestamp can replace missing capture metadata. Repeated passages can share a capture hash and URL but use different keys/locators.

`extracted` is staging: evidence fields may be null, references may still be incomplete, and lists may be empty. Such records must not be served as verified membership. `code_checked` requires the full structural and semantic checklist below. Schema gates require non-null quote/URL/retrieval/hash/locator for all sources in a checked record; `document_date` may remain null. `human_verified` additionally requires actual review of this exact record revision and proof scope; no automatic promotion. Per-source verification records independent capture review, not approval of every derived interpretation. A legacy human-reviewed row lacking the new capture metadata stays untouched in legacy storage; a new derivative stays extracted until its own promotion requirements are met. Never invent metadata to fit v1.

## Aliases and program GE applicability

`official`, `common`, and `former` aliases refer to this record within its year/scope; `candidate_ids` is empty. `ambiguous` requires at least two full logical IDs and always returns candidates rather than choosing a meaning from the selected major. Cross-record normalized-label collisions are also ambiguous, even if each record individually has a non-ambiguous alias. `source_refs` prove the target meaning; a common user label is not presented as official wording. Former names require evidence tying that wording to the scoped meaning. No alias implies an old-to-current policy equivalence, a waiver, or applicability across years. Unknown aliases stay unresolved.

`applicability.pattern` is `legacy|current|unspecified`, an evidence-backed label within `catalog_year`, not a date cutoff or a crosswalk. Put exact catalog-entry/cohort/transfer conditions in `condition_refs`; use `unspecified` if their pattern is unproven.

`applicability.program_effects[]` has exactly `program`, `target_requirement_id` (campus logical ID or null), `effect` (`covered_by_major|waived|modified|unknown`), quoted `text`, `condition_refs`, `source_refs`. It captures a program-specific statement about a campus requirement separately from course membership. Attach it to an actual program/campus requirement record with its evidence. Null target means the designation is unresolved: retain quoted context for review and do not apply it to any campus requirement. If the statement's effect is unclear, use `unknown` and retain conditions. No `includes` are manufactured from summary unit totals or a statement that the major covers GE.

**Summary of Degree Units is a source heading, not a menu requirement.** Store a statement from it here on an appropriately targeted actual requirement; if no actual requirement can be identified, leave it in the original source context for later review rather than invent a requirement record. A coverage/waiver statement can be retained with no course list. Applying a quoted program effect never proves individual completion, transfer equivalence, shared credit, or a universal campus waiver. All effect references must match the same catalog context. No actual GE mapping or waiver is supplied by CP2.

## Promotion checks before `code_checked`

JSON Schema validates shape, discriminants, primitive formats (when format checking is enabled), positive counts/units and trust-field presence. It cannot prove policy or cross-field relationships. A later semantic validator must fail promotion unless all checks pass:

1. Every source/condition/rule key is unique in its namespace; every reference resolves. Identity belongs to the approved program inventory or campus; catalog years are consecutive and agree with source context. Target IDs/candidate IDs resolve in the declared year, with appropriate scope. No summary-only menu nodes.
2. Original capture bytes reproduce each source hash; quote and locator reproduce the cited passage; official URL/heading/year/program genuinely apply. Required retrieval/review metadata was actually recorded. Every operative rule, condition, alias mapping and program effect has contextual proof, not merely a URL.
3. Audit **all course codes** in relevant passages, including tables, footnotes, exclusions, examples, cross-lists and repeated branches. Reconcile each as include, exclusion, conditional, irrelevant with documented reason, or unresolved. Every included code must appear in its cited quotation in an eligible context. A graduate-level inclusion requires explicit identification in the quote. Check codes against the requested catalog year's course records and flag missing matches for the review file. Preserve explicitly sourced membership with the missing course fact flagged. Reconcile duplicate occurrences only after checking that the scope, restrictions and rule meaning agree, preserving their source passages.
4. Check positive/exclusion intersections using course plus term/section/topic/conditions and enclosing branch. Same-scope overlap is invalid; genuinely disjoint scoped paths may coexist. An unrestricted exclusion intersects a restricted include. Unknown overlap is unresolved and blocks an unconditional claim. Opposite alternative branches are not automatically a global conflict.
5. Preserve AND/OR, choose-count, units, conditional and approval wording exactly. Every numeric threshold has explicit source proof; no inferred units or levels from course numbers, no summed units as a fabricated threshold, no cross-list equivalence inferred from a slash, and no inference from a placeholder or summary total. Unknown conditions are not true. Unsupported logic remains quoted/open and unevaluable.
6. Complete coverage requires explicit finite closure evidence and a reconciliation of every branch, not a program health count or successful parse. Exhaustiveness is independently reviewed from trust. A choose-count exceeding the closed eligible set, empty `required_all` without explicit zero proof, conflicting sources or missing restrictions blocks certification. Repeated-credit policies remain opaque unless sourced; do not create completion rules.
7. Resolve aliases by full identity/context; collisions return candidates. Apply program effects only to evidenced year/program/campus targets and never generate a course list from them. Preserve every original CE/SE reviewed row/status and maintain a separate review lineage for derivatives. Record actual validator version/time; human promotion requires a reviewer of the precise revision.

The schema deliberately does not implement this validator or completion logic at CP2. A structurally valid synthetic `code_checked` claim still cannot pass promotion without real evidence. Source-format presence checks are necessary, not sufficient.

## Proposed persistence after approval (not implemented)

Prefer existing identities and `CatalogCourseEligibility` for positive course/section rules. Do not force exclusions, open rules or GE effects into positive eligibility rows. Compare these exact storage alternatives at the next approved implementation step:

- **A, smallest catalog-local reuse:** add `programMetadata.requirementRecords = {schema_version: "1.0.0", records: [<v1 record>, ...]}` under each existing program/year. No Prisma migration. This cannot alone own campus records without duplication; a separate reviewed campus store is still required. Program publication currently rebuilds metadata and must later preserve this independently owned key. Therefore A alone is insufficient for the combined campus/program contract.
- **B, recommended single additive store:** proposed `RequirementLookupRecord` columns `scope String`, `scopeKey String` (program slug or literal `sjsu`), `catalogYear String`, `requirementKey String`, `catalogVersionId String?`, `payload Json`, `updatedAt DateTime @updatedAt`; compound primary key `[scope, scopeKey, catalogYear, requirementKey]`, nullable FK to `CatalogVersion.id` with `onDelete: Restrict`. Program rows require the existing matching catalog-version FK; campus rows require null. `payload` is exactly the v1 document; revision/trust/coverage remain there, avoiding duplicated mutable columns. The publisher validates payload identity equals the columns. Database CHECK constraints should enforce allowed scopes and the program/campus FK nullability. No fake campus Program/CatalogVersion is created. Course IDs remain in existing positive eligibility rows; this payload uses canonical codes. Historical review evidence must remain available before replacing payloads; no audit-history machinery is added at CP2.

Neither alternative, table, migration nor publisher exists from this work. After approval only, a prospective migration directory is `api/prisma/migrations/<UTC_timestamp>_requirement_lookup_record/` for B; it must be created and reviewed then. There is **no executable CP2 migration command** and no claim that this path exists. A future runbook must first resolve an explicitly named disposable scratch URL, verify its server/database identity differs from active catalog/accounts databases, pin reviewed schema/migration inputs, then give the exact approved create/apply commands against that scratch target. Do not blindly use existing `DATABASE_URL`, run a generic migrate command now, reset/reseed any database, or deploy a nonexistent migration.

Future scratch acceptance: additive replay preserves IDs, reviewed CE/SE rows, all saved plans/completions/schedules/operations and existing Planner payload membership for all ten majors; two identical publications write no record/rule changes; a malformed/partial/older source retains last-good records and review status. Publication must be transactional and source-scoped, reusing the current importer lock without replacing unrelated evidence. Only after those checks and further approval can integration switch a read path. Membership parity compares source records before duplicate-credit projection; Planner parity compares its unchanged projection separately.

## Local validation (CP2 only)

The [synthetic fixture](schemas/requirement-record.synthetic.json) is **extracted and fictional**, with a fictitious program/courses, no official policy claims and null URL/retrieval/hash/locator. It demonstrates `choice AND (approval OR units)`, separate exclusions, section/topic/term conditions, a common alias and an unresolved program GE effect. It is a shape example, not a publishable approved-program record. No fabricated metadata is persisted to obtain a checked status.

Availability commands, executed from `C:/Users/thinh/CMPE131`:

```powershell
py -c "import importlib.util; print('jsonschema_available=' + str(importlib.util.find_spec('jsonschema') is not None))"
py -c "from importlib.metadata import version; import jsonschema; print('jsonschema=' + version('jsonschema')); print('Draft202012Validator=available')"
```

Output (both exit 0):

```text
jsonschema_available=True
jsonschema=4.26.0
Draft202012Validator=available
```

Exact validation command (exit 0; no dependencies installed, files changed or network requests made by this check):

```powershell
@'
import copy
import json
from importlib.metadata import version
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
base = Path('docs/schemas')
schema = json.loads((base / 'requirement-record.schema.json').read_text(encoding='utf-8'))
record = json.loads((base / 'requirement-record.synthetic.json').read_text(encoding='utf-8'))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
validator.validate(record)
print('jsonschema=' + version('jsonschema'))
print('Draft202012 schema: PASS; synthetic extracted record: PASS')
for kind in ('required_all', 'choose_courses', 'choose_units', 'open_rule', 'approval_required'):
    case = copy.deepcopy(record)
    case['rule'] = copy.deepcopy(record['rule']['children'][0])
    case['rule']['kind'] = kind
    case['rule'].pop('count', None)
    if kind == 'choose_courses': case['rule']['count'] = 1
    if kind == 'choose_units': case['rule']['units'] = 3
    validator.validate(case)
print('Five leaf kinds + nested AND/OR: PASS')
case = copy.deepcopy(record)
case.update(scope='campus', program=None)
validator.validate(case)
case['aliases'][0].update(kind='ambiguous', candidate_ids=['campus:sjsu:2026-2027:synthetic-one', 'campus:sjsu:2026-2027:synthetic-two'])
validator.validate(case)
print('Campus scope + ambiguous alias shape: PASS')
invalid = []
case = copy.deepcopy(record); case['rule']['children'][0]['count'] = 0; invalid.append(('zero count', case))
case = copy.deepcopy(record); case['rule']['children'][1]['children'][1].pop('units'); invalid.append(('missing units', case))
case = copy.deepcopy(record); case['rule']['includes'] = []; invalid.append(('flattened group includes', case))
case = copy.deepcopy(record); case['scope'] = 'campus'; invalid.append(('campus program mismatch', case))
case = copy.deepcopy(record); case['unexpected'] = True; invalid.append(('unknown field', case))
case = copy.deepcopy(record); case['sources'][0]['url'] = 'https://sjsu.edu.evil.example/policy'; invalid.append(('nonofficial host', case))
case = copy.deepcopy(record); case['verification'].update(status='code_checked', checked_at='2026-11-20T00:00:00Z', checked_by='synthetic-validator'); invalid.append(('checked without capture evidence', case))
case = copy.deepcopy(record); case['sources'][0]['retrieved_at'] = 'not-a-date'; invalid.append(('invalid retrieval format', case))
for label, case in invalid:
    assert not validator.is_valid(case), label
print('Structural negatives: 8/8 rejected')
# CP2 demonstration only: identical scoped positive/exclusion conflict.
# Not the planned contextual proof or restriction-intersection validator.
def identity(entry):
    return (entry['code'], entry['term_id'], tuple(entry['section_numbers'] or []), entry['topic'], tuple(sorted(entry['condition_refs'])))
def no_identical_overlap(leaf):
    assert {identity(c) for c in leaf['includes']}.isdisjoint(identity(c) for c in leaf['exclusions']), 'included/excluded overlap'
leaf = copy.deepcopy(record['rule']['children'][0])
no_identical_overlap(leaf)
leaf['exclusions'].append(copy.deepcopy(leaf['includes'][0]))
case = copy.deepcopy(record); case['rule']['children'][0] = leaf
validator.validate(case)
try:
    no_identical_overlap(leaf)
except AssertionError as error:
    assert str(error) == 'included/excluded overlap'
else:
    raise AssertionError('Semantic overlap was not rejected')
print('Semantic exact-scope overlap: schema accepts; CP2 assertion rejects (expected)')
print('No real source, DB, runtime, provider, or held-out validation performed')
'@ | py -
```

Output:

```text
jsonschema=4.26.0
Draft202012 schema: PASS; synthetic extracted record: PASS
Five leaf kinds + nested AND/OR: PASS
Campus scope + ambiguous alias shape: PASS
Structural negatives: 8/8 rejected
Semantic exact-scope overlap: schema accepts; CP2 assertion rejects (expected)
No real source, DB, runtime, provider, or held-out validation performed
```

The inline overlap assertion demonstrates only an identical-scope conflict; it does not implement the full semantic promotion checklist, broader restriction intersections or policy validation. Modified status/timestamp values in negative tests exist only in memory and assert no real review. No DB reads/writes, migrations, restarts, provider calls, source extraction, held-out inspection or runtime/browser tests are performed in this workstream.

Changed paths owned by this workstream:

- `docs/REQUIREMENT_LOOKUP_RECORD_SCHEMA.md`
- `docs/schemas/requirement-record.schema.json`
- `docs/schemas/requirement-record.synthetic.json`
