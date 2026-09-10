# Computer and Software Engineering 2026-2027 snapshot

## Project decision-reporting agreement

After every code or design change, this file must be updated before the work is handed back. Each update must explain:

- what changed and which files or system areas were affected;
- the relevant technology or architectural pattern and why it fits;
- the alternatives considered;
- the trade-offs accepted, including UX choices such as scrolling, layout density, and navigation;
- data-flow choices, such as live API fetching versus reviewed fixtures or PostgreSQL persistence;
- what was checked, what was deliberately not checked, and what remains for later.

The report should teach the reasoning, not merely list changed filenames. It must distinguish current implementation from future plans and must never claim database, API, or browser verification that was not actually performed.

### Decision for this agreement

This project will keep a single living `IMPLEMENTATION.md` instead of creating a new report filename after every edit. A living report is easier to discover and prevents several partially overlapping status documents. The trade-off is that historical reasoning can become harder to trace, so substantial future decisions should be added as clearly dated decision entries rather than silently replacing earlier rationale. Git history can preserve the exact file-level evolution once the user chooses to commit.

## Implemented now

- Semester dropdown in the shared course drawer defaults to Fall 2026, with Fall/Spring choices for 2026 through 2022 (five calendar years). The dropdown shows three rows before scrolling. Historical choices display a data-pending state and never reuse Fall 2026 sections. Historical imports are deferred.

- Section cards now show instructor names imported from the Fall 2026 SJSU schedule. Click a card or its keyboard-accessible disclosure to reveal a Rate My Professors search link for each instructor, scoped to SJSU (school 881). These are name searches, not verified profile matches. Unknown instructors have no search link. Prisma stores instructor names per section; the new migration has not been applied.

- Main-page degree selector supports SJSU Computer Engineering and Software Engineering, 2026-2027 only. Selection carries to the prerequisite chart without local storage.
- Software Engineering has 30 named course options across eight semesters (120 required units with choose-one pairs counted once). New course prerequisites were reviewed against linked SJSU course pages on 2026-09-10. GE and elective slots remain choices.
- Shared courses reuse their IDs and section data, with program-specific prerequisites/semester placement. Bootstrap and course endpoints accept a `program` slug. The seed imports both catalog versions before importing shared sections once.
- The frontend lists all eight semesters from the official 2026-2027 four-year roadmap and opens course prerequisite details.
- The dataset is limited to catalog `2026-2027` and labeled `reviewed` with verification date `2026-09-09`.
- Roadmap course names, units, semester placement, GE/elective choices, and the linked course prerequisite text were checked against the official SJSU catalog.
- Corequisite relationships are stored separately from prerequisite relationships.
- A second frontend route, `/prerequisite-chart`, renders the eight semesters vertically with compact color-coded course nodes, `U1`/`U2`/`U3`/`U4` unit labels, solid prerequisite arrows, dashed corequisite arrows, hover highlighting, and the same click-to-open prerequisite drawer as the roadmap page.
- Prisma models catalog versions, courses, course versions, prerequisite rules, requirement groups, requirement items, and source snapshots.
- NestJS exposes read-only program, requirement, course, bootstrap, and health endpoints.
- The seed imports structured data; it does not contain hand-written SQL inserts.
- The Fall 2026 importer generated 414 official schedule rows for the union of 44 named course options across both programs. Each course drawer filters the snapshot by course code.
- Course drawers show section number, class number, lecture/lab component, meeting days/time, instruction mode, location, dates, and current open-seat count. Zero-seat sections remain visible as `0 open seats` without inferring why enrollment is unavailable.
- Prisma now models `Term` and `Section`; NestJS includes current-term offerings in `/api/v1/bootstrap`. The frontend uses the generated fixture when PostgreSQL is not running.

## Removed from this phase

- Student plans and browser local storage.
- Authentication and user IDs.
- Imported professor ratings and verified profile matching (instructor names/search links are implemented).
- Schedule-conflict checking.
- Planning and plan-validation endpoints.

## Source and boundary

Software Engineering source: [SJSU SE roadmap 2026-2027](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647). Choose MATH 33LA OR MATH 142 and MATH 161A OR ISE 130. ISE 130 requires MATH 32 outside this roadmap. CS 166 arrows show the CMPE 70 pathway; the full alternative condition remains in its detail text. These are planning-reference relationships, not an enrollment-eligibility engine.

Frontend and API TypeScript checks passed for the program-selector update. Database migration/seed and full integration testing remain deferred; no Docker was used.

Sources: [SJSU Roadmap: Computer Engineering, BS (2026-2027)](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19250&returnto=8647) and [SJSU Fall 2026 Class Schedule](https://www.sjsu.edu/classes/schedules/fall-2026.php).

The app intentionally contains no 2024-2025 or 2025-2026 catalog data. `ENGL 1A` and `BIOL 10` are stored as the roadmap's recommended choices for GE Areas 1A and 5B. Open-ended GE, university elective, and technical elective slots remain requirement choices instead of invented course records. The course catalog lists `CMPE 130` as a pre/corequisite for `CMPE 142`, although `CMPE 130` does not appear in this roadmap; that condition is preserved in `prerequisiteText` for later rule-engine handling.

## Next backend implementation

Build the catalog-version importer that validates duplicate IDs and missing prerequisite/corequisite references and publishes in one transaction. Later, normalize multi-pattern meeting rows for conflict checking and design the professor/instructor feature. Apply the Prisma migrations and seed PostgreSQL during the integration/testing phase so PostgreSQL becomes the runtime source of truth for React.
