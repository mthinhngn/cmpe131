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

### 2026-10-25: Recommendations editorial workbench

- Reworked `/recommendations` from a schedule-first stack into a task-first desktop workbench. The introduction explains what the assistant checks, a graphite action focuses the composer, and the conversation sits beside the currently locked weekly schedule. Unavailable-time controls and the per-turn context remain in the adjacent rail.
- Matched Overview's 1200px alignment, Course Radar wordmark, pill navigation, degree/catalog context, warm-paper surfaces, regular-weight headings, and sparse persimmon/brass accents. Route-scoped styles in `src/recommendations.css` keep the rest of the workspace unchanged; `Workspace.tsx` adds only the Recommendations shell class.
- Reused `WeeklySchedule`, `CatalogContext`, `ScheduleContext`, and `AgentSessionContext`. Starter prompts now use shorter visible labels while keeping their existing full request text. Proposal details, tool checks, warnings, confirm/cancel flow, apply feedback, unavailable-time validation, and session-only conversation behavior remain in the same data flow.
- Trade-off: the weekly calendar shares the sidebar with planning controls so students can keep their locked selections in view while composing a request. The chat remains the widest and most prominent work surface.
- Verification performed: visually inspected the rendered route at 1280×900 and 1440×1000; confirmed the main action focuses the message field, and confirmed the selected section, lock label, conflict status, availability controls, and context summary remain visible in the rendered page. No assistant request or schedule mutation was made.
- Build status: `npx vite build` passed. `npm run build` stops at four `TS2345` errors in the existing `src/App.tsx` course-detail code (lines 175, 190, 201, and 273: `string | undefined` passed where `string` is required), before Vite starts. The standalone Vite build also reports the repository's existing large-chunk advisory.
- Remaining uncertainty: live assistant responses and proposal application were not exercised because the page showed the reviewed-snapshot fallback and the scheduling API was unavailable. Mobile was outside this request's scope.

### 2026-10-25: Course Explorer editorial continuation

- Reworked `/courses` into a task-focused continuation of the landing and Overview shell: shared wordmark, capsule navigation, degree/catalog context, warm paper, regular-weight display typography, graphite text, and small brass/persimmon cues. The page now opens with a plain title and short purpose statement, then presents search, visible status filters, result count, a roadmap link, and the course list.
- Kept the search query and status in the URL, and retained existing `CourseStateBadge`, course detail, semester planning, Fall 2026 section selection, and selected-section schedule components. When sections exist, the schedule stays beside the list on wide desktop layouts; its existing mobile sheet behavior remains.
- Implementation uses a route-scoped CSS layer in `src/explorer.css` and a small composition update in `src/Workspace.tsx`. This avoids changing the other workspace routes or introducing a new component dependency. A page-specific grid lets the course list use the full width before schedule selection and share the available space afterward.
- Alternatives considered: retaining the single native status select was more compact but made the available states less discoverable; a separate schedule route would hide the weekly comparison while reviewing course sections. Visible status buttons and the existing conditional schedule pane keep both tasks at hand.
- Data flow is unchanged: courses and plan state still come from `CatalogContext`, search/status remain URL-backed, and selected sections still come from `ScheduleContext`. Availability remains the reviewed Fall 2026 snapshot represented by the existing workspace status message.
- Verification: `npm run typecheck` passed and `git diff --check` passed (Git emitted only existing LF/CRLF working-copy notices). A local Vite route was opened, but the Windows computer-use layer stopped before screenshot capture because it could not establish the current browser URL with sufficient confidence. `npm run build` reached Vite's transform phase but did not complete and was stopped. No visual browser review, mobile review, interaction test, or test suite is claimed.
- Remaining uncertainty: rendered spacing and the schedule-selected split still need visual confirmation in the user's browser. Existing responsive rules were adapted but not visually reviewed at mobile widths.

### 2026-09-12: Autonomous roadmap-to-section scheduling

- Replaced the course-ID-dependent agent path with a high-level `build_autonomous_schedule` tool. A plain request such as “Build my Fall 2026 schedule” is routed by the NestJS harness directly into this deterministic tool before Gemini writes the explanation, so the model cannot respond with a needless “which courses?” question.
- The tool reads every named `ProgramRequirement`, `CourseVersion`, complete grouped `PrerequisiteRule`, and target-term `Section` from PostgreSQL. The semester planner is now an optional ranking preference. Eligibility is derived from the official program roadmap and completed courses; when both planner and completed-course state are empty, the engine explicitly assumes a new student and starts at the earliest eligible roadmap requirements.
- Ordinary prerequisites must be completed. Only explicit corequisites may be satisfied by another course in the generated term. Minimum-grade and manual-review metadata remain visible warnings because Course Radar has no verified transcript grades. Placeholder requirements never become invented courses.
- Existing selected class numbers are hard locks. The generator preserves them even when a locked seat snapshot is zero and warns about locked conflicts or unavailable-time overlap. `ScheduleContext.replaceSchedule` independently rejects any proposal that removes a current/request-time lock or adds a new zero-seat section.
- For new choices, zero-seat sections are excluded. The bounded search combines every published component for each course, rejects unavailable-time and direct meeting conflicts, and explores both include/skip branches across eligible roadmap courses. If a higher-priority course has no usable component set or cannot fit, a lower-priority eligible course may be labeled `replacement`; the response includes a structured decision trace with eligible/rejected courses, replacements, locks, unit target, and examined-combination count.
- Ranking targets 15 units within a 12–15-unit default. If the authoritative snapshot cannot produce 12 units, the best verified partial schedule is returned with an explicit unit warning instead of fabricating a section. Within equivalent progress, earlier roadmap placement, planner preference, downstream prerequisite unlocks, fewer campus days, fewer gaps, and TBA uncertainty influence deterministic selection.
- The Recommendations page now begins with a read-only current-schedule dashboard. Every visible existing section is labeled locked. Agent conversation, draft, unavailable windows, and pending state moved to a scope-keyed `AgentSessionProvider`, so they survive React route navigation but intentionally clear on refresh. Proposal cards show total units, section source (`locked`, `new`, or `replacement`), and an expandable “Why this schedule” trace.
- Architecture choice: Gemini remains the natural-language intent/explanation layer, while prerequisite evaluation, section availability, conflict checks, backtracking, and ranking stay in pure TypeScript plus read-only Prisma queries. This is more testable and resistant to hallucination than asking the model to reason over raw rows; it still needs no LangChain, vector database, fine-tuning, authentication, or migration.
- Validation performed: frontend typecheck, 6 frontend schedule tests, production frontend build, API production build, and 19 API tests passed. The expanded domain suite covers planner-free scheduling, ordinary-prerequisite exclusion, different-course fallback, closed hard-lock preservation, TBA, conflicts, ranking, components, and prior function-loop safety. Ten JSON eval cases now include no-planner, different-course fallback, and hard-lock scenarios. A live request with an empty planner/completed list used `build_autonomous_schedule` without a follow-up, returned three database-backed 10-unit proposals, and explained that current availability prevented the 12-unit minimum. Browser verification confirmed the dashboard, proposal/source/decision UI, route-persistent conversation, zero horizontal overflow at the checked 746px viewport, and no console warnings/errors. Frontend port 5173, API port 3001, and PostgreSQL remained running. The local key was not printed; the tracked `api/.env.example` template was sanitized back to a blank key.
- Remaining uncertainty: the imported schedule still lacks verified component-pairing relationships and normalized date-aware meetings, so multi-component and TBA cases remain manual-review warnings. The deterministic engine treats selected sections as hard locks exactly as requested; a student must remove a lock manually before asking for replacement. This remains a planning aid, not an official degree audit or registration system.

### 2026-09-11: Gemini scheduling agent with deterministic planning tools

- Replaced the inactive `/recommendations` preview with a working agent workspace. React owns the conversation only in component memory, so refresh clears it; each request sends at most eight prior turns plus the current program, catalog year/term, completed course IDs, semester-plan entries, selected class numbers, unavailable windows, and optional time preferences.
- Added `POST /api/v1/agent/messages` in a dedicated NestJS `AgentModule`. The backend uses `@google/genai` Interactions API with `gemini-3.1-flash-lite`, always sends `store: false`, and loads `GEMINI_API_KEY` from `api/.env` through `dotenv`. The key remains blank in `api/.env.example`; no secret is exposed through Vite.
- Implemented an application-controlled function-calling loop with a hard maximum of six calls. Only `get_current_plan`, `get_course_requirements`, `search_sections`, `find_alternative_sections`, `generate_schedule_candidates`, and `validate_schedule` are accepted. Zod rejects unknown request fields and malformed tool arguments. The tools are read-only Prisma queries or pure TypeScript calculations; Gemini cannot execute SQL or mutate browser state.
- Added a deterministic backend scheduling domain. It resolves requested course IDs against the selected PostgreSQL term, preserves lecture/lab/discussion components, filters structured unavailable windows, rejects direct meeting overlap, retains zero-seat alternatives, and ranks complete candidates by open-seat status, fewer campus days, fewer gaps, then preferred time range. Search is bounded by `AGENT_MAX_COMBINATIONS` and returns at most three distinct proposals.
- TBA/unparseable meetings remain visible with manual-review warnings rather than being labeled conflict-free. Multi-component courses combine one section per exposed component but warn that the source does not verify lecture/lab pairing. Same-course/component alternatives preserve the original component.
- Prerequisite evaluation reads Prisma `groupKey`, `AND`/`OR`, `isCorequisite`, `minimumGrade`, and `requiresManualReview`. Completed courses satisfy ordinary prerequisites; same-term requested courses satisfy only explicit corequisites. Minimum-grade and manual-review rules remain warnings because Course Radar has no verified grade data.
- Added safe error mapping for missing configuration, authentication failure, free-tier 429, provider/network failure, empty/refused output, malformed calls, tool-loop exhaustion, and PostgreSQL/catalog unavailability. Responses expose stable error codes and user-facing recovery copy without leaking provider error details.
- Added an agent catalog preflight before any Gemini request, avoiding free-tier token use when the requested catalog/term is unavailable. `PrismaService` now logs a startup warning instead of terminating the whole API when PostgreSQL is down, allowing React to retain its reviewed-fixture fallback while the agent returns `CATALOG_UNAVAILABLE` once configured.
- Configured Nest CLI to clear `dist` before compilation and disabled TypeScript incremental output for this small API. This prevents a stale historical `dist/src/main.js` from being selected by `nest start --watch` instead of the current `dist/main.js`; keeping an incremental build-info file while deleting output could also make TypeScript incorrectly skip emission.
- Extended `ScheduleContext` with `replaceSchedule`. It accepts only class numbers in the current catalog snapshot, rejects duplicate course components and confirmed meeting conflicts, and updates browser `localStorage` only after a two-step `Apply this schedule` confirmation in the UI. Gemini itself never applies a proposal.
- The new interface follows the existing editorial Crimson/Atkinson design system rather than introducing a generic AI palette. It includes an accessible conversation/composer, starter prompts, readable tool activity, structured day/start/end controls, proposal details, warnings, disabled/loading states, and responsive single-column fallbacks. The `ui-ux-pro-max` guidance was used for visible labels, 44px controls, keyboard focus, textual error/loading feedback, and no-overflow responsive behavior.
- Alternatives considered: LangChain was omitted because six typed tools and a bounded loop are simpler here; LangSmith was replaced with checked-in JSON eval cases and mocked Node tests; RAG/pgvector were omitted because catalog facts already have relational structure and exact filtering requirements; fine-tuning was omitted because agent behavior is constrained by the system prompt, schemas, and deterministic tools. Authentication and a new Prisma migration remain out of scope.
- Data flow: React session state -> validated NestJS request -> stateless Gemini interaction -> validated function call -> Prisma/pure scheduling tool -> function result -> Gemini explanation. Schedule proposal -> explicit React confirmation -> validated bulk replacement in browser storage. If PostgreSQL is absent, agent tools fail safely rather than using the frontend fallback fixture as authoritative.
- Validation performed: frontend TypeScript, all 6 existing frontend schedule tests, and the production frontend build passed. API TypeScript, all 15 API domain/agent tests, and the NestJS production build passed. Tests cover blank-key recovery, catalog preflight failure, JSON eval coverage, unavailable-window containment, direct containment conflicts, TBA warnings, open-seat/day/gap ranking, impossible schedules, multi-component warnings, prerequisite groups, sequential function calls, `store: false`, malformed/unknown tools, maximum-step enforcement, and 429 mapping. Seven checked-in JSON eval scenarios cover alternatives, unavailable time, prerequisite failure, impossible schedules, fabrication resistance, and confirmation-only mutation. After PostgreSQL migration/seed and local key configuration, a live end-to-end smoke request passed: Gemini called `get_current_plan`, received the read-only tool result, and returned a grounded summary with no error or proposal. The key was never printed by the verification command. Frontend, API, and PostgreSQL listeners were all running after the check. `git diff --check` passed before the user supplied their local secret.
- Remaining uncertainty: the Fall 2026 source still stores display strings rather than normalized meetings and does not provide verified component-pairing relationships. Free-tier quotas/model availability can change. The JSON eval cases are review fixtures, not live model-scored evaluations. This course demo is not an official degree audit or enrollment system, and free-tier data-use terms make it inappropriate for protected student records.

### 2026-09-11: Course Explorer schedule builder and readable time grid

- Added a manual Fall 2026 schedule builder to Course Explorer. A student selects a section from the existing course drawer, then the weekly schedule appears beside the course list on desktop or behind a `View schedule` sheet on narrower screens. The existing eight-semester Planner remains unchanged and separate.
- Added `ScheduleContext` as the owner of personal section selections. Records are isolated by program, catalog year, and term and stored under the versioned browser key `course-radar-schedules-v1`. This is deliberately browser-only: there is no user ID, schedule database table, or write API.
- Added a pure meeting parser and pairwise conflict detector in `src/schedule.ts`. It accepts the ordinary SJSU day/time strings plus the composite strings present in the imported snapshot. Overlap uses half-open intervals, so a class ending exactly when another begins is allowed. TBA or unparseable sections are shown separately instead of being presented as conflict-free.
- The weekly grid uses one line per hour rather than 30-minute slots. Exact meeting minutes determine each block's vertical position and height. Each class block puts course/section first, the full start-end time on its own row, then professor and room. Hour labels sit at row boundaries with an opaque background so a rule cannot visually strike through the text.
- Conflicting sections remain visible and receive a red patterned treatment plus a textual warning below the calendar. Color is not the only conflict signal. Selecting another section of the same course component replaces it, while distinct components such as lecture and lab may coexist.
- Backend connection: the feature consumes `CourseOffering` data already returned by NestJS `/api/v1/bootstrap`, including instructors and location, and uses the same generated offering fixture during API fallback. No new backend endpoint or Prisma migration was needed for this browser-owned V1.
- UI/UX trade-offs from `ui-ux-pro-max`: progressive disclosure keeps the schedule hidden until the first selection; desktop space is split only when needed; mobile uses a 44px-accessible schedule trigger and full-screen sheet; warnings have both visual and textual forms. The calendar is an aid rather than the only representation because selected sections and TBA rows remain readable as text.
- Alternatives considered: automatic schedule generation was deferred because it needs preference/ranking inputs; prerequisite validation was intentionally excluded from this feature because the schedule builder answers a narrower time-planning question; 30-minute rows were rejected because they made the timeline noisy; database persistence was deferred until authenticated ownership exists.
- Validation performed: `npm run typecheck`, all 6 `npm test` meeting/conflict tests, `npm run build`, and `git diff --check` passed. The NestJS typecheck passed during the schedule implementation. Per the user's request, no Playwright or browser automation was used for the final time-grid adjustment; final visual acceptance remains the user's live UI check.
- Remaining uncertainty: the current source exposes meeting days/times as display strings rather than normalized backend meeting records, and it does not provide a reliable lecture/lab pairing contract. Date-range overlap is not evaluated in V1 because all selectable offerings belong to the same Fall 2026 snapshot. Browser storage is device/browser-specific and is not a registration record.

### 2026-09-11: Current architecture and schedule-creation plan

- Added two deliberately separate documents: `SystemDesign.md` now describes only architecture and behavior verified in the current checkout; `ScheduleCreationPlan.md` contains the ordered future implementation plan for the browser-owned schedule builder. This prevents proposed components from being mistaken for current code.
- Documented the current React/NestJS/Prisma/PostgreSQL and fixture-fallback data flow. The review identified that `CatalogContext` currently combines catalog access with in-memory personal state, the planner stores course-level semester slots but no selected sections, and bootstrap flattens richer Prisma prerequisite rules.
- Recommended a pure TypeScript planning validator fed by versioned catalog, schedule, and browser-plan data. This keeps authentication and database-backed student plans out of the current MVP while leaving a reusable boundary for a future stateless NestJS validation endpoint.
- Defined prerequisite semantics explicitly: an ordinary prerequisite must be completed or placed in an earlier planned term; the same term is invalid unless the relationship is an explicit corequisite. Earlier planned prerequisites are conditional planning assumptions, not proof of enrollment eligibility.
- Defined time-conflict semantics around normalized meeting days, minute ranges, date ranges, and arrangements. Raw `days`/`times`/`dates` strings are retained for display/audit but are deliberately not recommended as validator inputs. TBA or unparseable meetings must warn instead of silently passing.
- Alternatives considered: calculating overlaps directly from display strings was rejected as unreliable; saving personal plans in PostgreSQL now was deferred because accounts are out of scope; duplicating frontend/backend rule logic was rejected in favor of a pure reusable domain boundary.
- UX trade-off: course-level planning remains possible before a section is chosen, but the proposed status is “section required,” not “schedule valid.” This supports early exploration without giving a false conflict-free result.
- Validation performed: inspected the live frontend routes and state, course-state derivation, planner UI, course drawer, catalog/offerings types, schedule importer, NestJS controllers/services, Prisma schema/seed, Docker Compose, README, and current Git status. Documentation consistency was checked after editing. No runtime code changed, so frontend/API builds, database migration/seed, and browser interaction tests were not run for this documentation-only change.
- Remaining uncertainty: the current schedule source does not yet provide normalized meeting patterns or a verified lecture/lab association contract. `ScheduleCreationPlan.md` requires parser evidence and explicit unknown/manual-review handling before conflict UI implementation.

### 2026-09-11: Readable typography scale

- Increased small interface text across the workspace without changing the approved editorial structure, colors, navigation model, or interactions. The root scale is now 16px, functional labels generally use 11–13px, supporting copy uses 12–15px, and dense course titles remain 14–15px.
- Raised navigation, context-bar, metadata, helper copy, progress labels, next-step copy, table headers and rows, planner controls, requirement rows, offering details, chart legends, chart controls, course nodes, relationship summaries, badges, and footer copy into a more readable scale.
- Preserved hierarchy by scaling functional text selectively instead of zooming every display heading. The CourseRadar tagline keeps its uppercase tracking, and chart nodes retain a small height allowance so larger labels wrap without colliding with status rows.
- Reduced Course Explorer rows from 66px to 54px on desktop while increasing the row copy to 15px and course codes to 14px. This keeps the list readable but removes the large inactive gaps between courses.
- Reworked each desktop Semester Planner course into a two-column internal grid: course identity, status, and prerequisite notice stay together on the left; move/remove controls use the otherwise empty area on the right. Typical populated rows now measure about 86–111px at the checked viewport instead of stacking every control vertically. At widths below 900px the semester cards become one column; below 760px each course returns to a stacked layout to preserve touch usability and prevent cramped controls.
- Alternatives considered: globally shrinking card padding alone would save little space because the planner's stacked controls caused most of the height; compressing the font would directly conflict with the readability goal. The internal grid uses available horizontal space and keeps the same controls and data flow.
- No React state, API calls, backend code, database schema, migrations, or business logic changed. This is a CSS-only presentation refinement in `src/workspace.css`.
- Validation performed: live browser measurements confirmed 54px Course Explorer rows with 15px titles, populated planner rows around 86–111px at 789px, the one-column tablet fallback, the stacked 390px mobile fallback, and no page-level horizontal overflow. `npm run typecheck` and `npm run build` passed. Backend and database tests were deliberately not run because those systems were not modified.

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

- Database-backed student schedules and cross-device persistence.
- Authentication and user IDs.
- Imported professor ratings and verified profile matching (instructor names/search links are implemented).
- Database-backed or auto-applied schedules; agent proposals remain read-only until browser confirmation.
- A general-purpose planning write API; the agent endpoint does not persist student state.

## Source and boundary

Software Engineering source: [SJSU SE roadmap 2026-2027](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647). Choose MATH 33LA OR MATH 142 and MATH 161A OR ISE 130. ISE 130 requires MATH 32 outside this roadmap. CS 166 arrows show the CMPE 70 pathway; the full alternative condition remains in its detail text. These are planning-reference relationships, not an enrollment-eligibility engine.

Frontend and API TypeScript checks passed for the program-selector update. Database migration/seed and full integration testing remain deferred; no Docker was used.

Sources: [SJSU Roadmap: Computer Engineering, BS (2026-2027)](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19250&returnto=8647) and [SJSU Fall 2026 Class Schedule](https://www.sjsu.edu/classes/schedules/fall-2026.php).

The app intentionally contains no 2024-2025 or 2025-2026 catalog data. `ENGL 1A` and `BIOL 10` are stored as the roadmap's recommended choices for GE Areas 1A and 5B. Open-ended GE, university elective, and technical elective slots remain requirement choices instead of invented course records. The course catalog lists `CMPE 130` as a pre/corequisite for `CMPE 142`, although `CMPE 130` does not appear in this roadmap; that condition is preserved in `prerequisiteText` for later rule-engine handling.

## 2026-10-25: Desktop web redesign

Applied the Course Radar Figma visual direction to the existing React app through `src/studio.css` and `src/Workspace.tsx`: a persistent desktop sidebar, green/lime semantic palette, editorial overview with linked Explore / Connect / Plan actions, clearer cards and course lists, and aligned roadmap, prerequisite chart, planner, course drawer, calendar and scheduling assistant surfaces. Existing state providers, course data, search controls and scheduling logic remain the integration boundary.

The user clarified that the target is desktop browser, so separate mobile design and mobile verification are outside this follow-up. Basic narrow-window navigation fallback remains. The new stylesheet deliberately preserves existing functional layout rules, at the cost of retaining legacy CSS cascade complexity.

Verification: production build passed and all six existing meeting/conflict tests passed. The local development server returned HTTP 200 at `http://127.0.0.1:5173/`. Browser automation is disabled in Work settings, so the implemented app has not had fresh visual or browser interaction verification. Figma screenshots checked earlier are design evidence only. See `FIGMA_REDESIGN.md` for the design link, source grounding and handoff details.

## Next backend implementation

Normalize multi-pattern meetings during import so both the manual calendar and deterministic agent tools consume structured day/minute/date ranges. Add verified lecture/lab association metadata when the official source exposes it. Before deployment, repeat migration/seed and the live smoke check in the target environment.

### 2026-10-19: Vercel frontend deployment and GitHub integration

- Created the Vercel project `cmpe131` in the personal `mthinhngns-projects` team and connected it to GitHub repository `mthinhngn/cmpe131`; the linked production branch is `main`. Vercel project settings use the Vite preset, `npm run build`, and `dist`.
- Added `.vercelignore` with `api/` because Vercel interpreted the NestJS and Prisma backend tree as many independent serverless functions. The first production attempt exceeded the Hobby plan's 12-function limit. Excluding the backend keeps the Vercel deployment aligned with the root Vite frontend.
- Added a root `vercel.json` SPA rewrite from all paths to `/index.html`, so browser navigation and direct links to React Router paths resolve correctly on Vercel.
- Architecture choice: deploy the static Vite client on Vercel and keep the NestJS/PostgreSQL/Gemini backend as a separate service. Trying to package the current Docker/PostgreSQL backend as Vercel functions would need a different serverless entry point, hosted database configuration, and environment variables. The frontend already has reviewed catalog fixtures for offline catalog views, so a static deployment provides those screens without pretending the agent API is available.
- Data flow in production: browser loads Vite assets from Vercel; catalog screens fall back to bundled data when the configured local API is unavailable. The recommendations agent still requires the NestJS API, PostgreSQL, and optional Gemini key; those services are not deployed or configured here.
- Verification performed: the Vercel production build completed successfully from a clean snapshot of `origin/main` commit `c91676427646a407cbe125719cacf36965a63074`, plus the two local Vercel configuration files. The production alias is `https://cmpe131.vercel.app` (deployment ID `dpl_5NbXzTdckaNh2DzKCMnXvgJswKjo`, READY). Direct HTTP checks returned 200 for `/`, `/courses`, `/roadmap`, `/prerequisite-chart`, `/planner`, `/recommendations`, and the emitted JavaScript/CSS assets. Tests and browser interaction were not run.
- GitHub connection settings are active, but `.vercelignore`, `vercel.json`, and this report remain local and uncommitted. Future GitHub-triggered builds need these config files pushed so Vercel continues excluding the backend and applying SPA rewrites. The current deployment used a clean tracked-file snapshot and did not include unrelated untracked workspace files.
# 2026-10-25 desktop visual revision

The earlier Figma-inspired academic studio treatment was rejected in browser review. The desktop application now uses a light navigation rail, restrained indigo accents, flatter data surfaces, shorter empty states, and direct task language. `src/studio.css` holds the visual layer; `src/Workspace.tsx` and `src/Recommendations.tsx` update content and shell markup. Catalog, planning, scheduling, and API state remain in the existing providers and components.

The design pass applies the `emil-design-eng` skill's interaction principles: short targeted transitions, subtle pressed feedback, and reduced-motion handling. It avoids ornamental transitions on repeated navigation and data rows. Legacy rules still live in `src/workspace.css`; the late `studio.css` layer is reversible but increases cascade complexity until styles are consolidated.

Desktop visual review used fresh Chrome headless screenshots at 1440×1000 for Overview, Course explorer, Semester planner, Degree roadmap, and Recommendations. The shared Browser controller was disabled in Work settings, so live pointer and keyboard testing there was unavailable. Existing scheduling tests passed (6/6); final production build validation is recorded in the current task handoff.


## GitHub design restoration — 2026-10-25

The user rejected the recent visual redesign and asked to return to the design at https://github.com/mthinhngn/cmpe131. Restored the app source files in `src/` to the fetched `origin/main` snapshot (`8ccee9d9247ac168120a24c588354f1875c86530`), which is also the checked-out HEAD. Removed the unused generated `src/studio.css`. This restores the repo's original Course Radar workspace shell, navigation, page headings, summaries, and legacy styling while keeping the tracked source identical to the requested GitHub revision. No deployment or Git commit was made.

Verification: `npm run typecheck` passed and `npm run build` passed. Browser automation is disabled in Work settings, so no interactive visual inspection was available; local HTTP preview availability is checked separately. Untracked project notes and `.taste-skill/` artifacts were preserved.

## Desktop motion pass — 2026-10-25

Applied the `animate` skill from [Emil Kowalski's skills repository](https://github.com/emilkowalski/skills/tree/main/skills/animate), including its animation recipes and opportunity filter. Motion is limited to interactions with a clear purpose: a 160 ms, 3 px page-content handoff prevents route content from teleporting; the occasional course-detail drawer enters from the right and exits the same way, with a matching dimmer; primary actions get a subtle press response. Search keystrokes, course-map positions, and data rows are not staged or moved for decoration.

Implementation uses CSS transitions and `@starting-style` with the skill's easing tokens; React keeps the drawer mounted for its 240 ms exit and routes Escape, close-button, and backdrop dismissal through the same path. Data and planning state are unchanged. The previous blanket reduced-motion shutdown is now targeted: route/drawer transforms become opacity-only, scroll becomes instant, and the agent's loading pulse stops.

Verification: `npm run build` passed; all 6 existing schedule tests passed; `git diff --check` passed; `/prerequisite-chart` returned HTTP 200. The Codex browser preview was queued at that route. Interactive visual inspection is still unavailable because local browser automation is disabled in Work settings, so the exact motion feel should be checked in the live preview.

## Motion refinement — 2026-10-25

Following the user's request for more visible motion, the reduced-motion treatment now scales motion down instead of removing most transitions. It keeps short fades and smaller travel distances for page entry, drawer movement, planner/status changes, and course-node hover/selection; it still disables the continuous agent pulse and makes scrolling immediate. Standard motion now uses a brief stagger when a workspace route enters, a clearer drawer slide, and eased entrance feedback when planner and generated schedule cards appear. The course graph's relationship geometry remains fixed so it stays readable.

This section supersedes the reduced-motion behavior described in the earlier desktop motion pass. Data, routes, and planning behavior are unchanged. Verification after this refinement: `npm run build` passed; the six existing schedule tests passed immediately before the final CSS-only adjustment; `git diff --check` and the `/prerequisite-chart` HTTP check passed. Interactive browser automation remains disabled in Work settings, so visual feel has not been independently inspected in-browser.

## Motion visibility correction — 2026-10-25

The prior motion pass was too subtle in practice: chart-node hover/selection moved only 1–2 px, and `@starting-style` entry transitions did not reliably replay on an already-open route. Replaced those with explicit CSS entrance keyframes on route content, a staggered semester-band reveal on the prerequisite chart, a longer course drawer slide, and stronger hover/focus/relationship transitions. Reduced-motion mode retains visible but shorter and lower-travel variants; it does not turn off the interface motion system.

Verification for this correction: `npm run build` passed; all 6 existing schedule tests passed; `git diff --check` passed; `/prerequisite-chart` returned HTTP 200. Browser automation remains unavailable in Work settings, so this addresses the reported lack of motion from the selectors and timing behavior rather than claiming a live interaction review.

## Motion setting update — 2026-10-25

The user explicitly asked to remove motion restrictions. Removed all `prefers-reduced-motion` rules and JavaScript checks from the app and design-preview styles. The full route, chart-row, course-drawer, course-focus, schedule-entry, and agent-pulse animations now run at their normal timing regardless of the operating-system motion preference. This keeps the existing `origin/main` visual design as the base; the only tracked-source differences are the animation implementation.

## Steep editorial redesign — 2026-10-25

Read the supplied Steep style reference and reworked the desktop site around its white paper canvas, mist-gray surfaces, near-black typography, oversized serif headlines, quiet Inter body text, restrained borders, rounded controls, and sparse peach accent. The overview is recomposed as an editorial introduction surrounded by floating, data-backed degree-progress, first-semester, and planning cards. Course explorer, roadmap, prerequisite graph, planner, recommendations, and the course-detail drawer now share the same visual language. Existing navigation, catalog data, course actions, planner controls, and scheduling interactions remain attached to their original data flows. No decorative photos were added; the reference calls for product data imagery, which is represented by live course and progress artifacts.

Implementation uses a new `src/steep.css` layer after the legacy workspace stylesheet so the redesign stays easy to inspect and revise without replacing route logic. The extra layer also required explicit overrides for a few legacy state colors and hidden roadmap summaries. This keeps existing interactions intact, with some cascade duplication as a maintenance trade-off until a future stylesheet consolidation. Updated two page headings to make the roadmap and prerequisite map read more editorially.

Verification: visually reviewed the live desktop preview at 1440×1000 on Overview, Course explorer, Degree roadmap, Prerequisites, Semester planner, Recommendations, and the course-detail drawer. The preview remains available at http://127.0.0.1:5173/. Mobile review was omitted at the user's request. No automated tests or production build were run in this design pass; live route rendering and the inspected UI states are the verification performed. No remaining design uncertainty is known from the reviewed desktop views.

## Ventriloc redesign with Taste frontend skill — 2026-10-25

The current user-supplied Ventriloc MD is the visual source of truth and supersedes the earlier Steep and Impeccable directions. The Taste frontend skill informed the design read, audit-first workflow, anti-template choices, accessibility checks, and browser review. Its v2 scope is mainly landing pages and portfolios, so its marketing-page patterns were not imposed on this degree-planning dashboard. The confirmed audience is SJSU students planning degree progress and term schedules. Direction dials: variance 6, motion 3, density 4. The page stays light because the Ventriloc reference explicitly describes a print-like warm-paper canvas.

The visual layer now lives in `src/ventriloc.css`, using the reference's white, Ash, Fog, and Ivory surfaces; Graphite and Steel text; Inter body text; and the reference's PolySans-compatible Space Grotesk heading stack. Buttons stay square, data cards stay flat, and the featured first-semester card uses the Ivory surface. Ember and Brass have distinct jobs in the course-distribution chart and prerequisite/corequisite graph. The graph's semester bands and the planner's term cards alternate Ash and Fog for added rhythm without introducing colors outside the reference palette. Charts and roadmap data remain the visual material; no stock image was added because the reference says charts should serve as imagery.

Removed `styles.css` and `workspace.css` from the app's import path so their earlier visual rules no longer override Ventriloc. Those files remain in the repository. The existing React routes, catalog provider, roadmap and prerequisite data, course detail, filters, session planning, section schedule, conflict display, and assistant state remain the source of behavior and data. Route paths were not changed. The overview's overlapping progress card no longer repeats the catalog year where the foreground card obscured it; the year remains on the course-distribution card.

The alternatives were an image-led hero and a brighter multi-hue palette. Both were set aside because they conflict with the supplied reference. Keeping the redesign in CSS lowers risk to the existing product logic, though the unused legacy stylesheets remain available and could cause confusion if re-imported later. The new stylesheet includes responsive rules and reduced-motion handling; the light theme is intentional under the reference's print-emulating editorial exception.

Verification: visually reviewed the live local browser at 1230×690 on Overview, Courses, Roadmap, Prerequisites, Planner, and Assistant. The course-distribution bars, first-semester card, planner surfaces, prerequisite legend, chart rows, and assistant schedule panel rendered in the new system. The preview remains open at http://127.0.0.1:5173/. No automated tests or production build were run. Mobile viewport rendering, the detail drawer after this stylesheet isolation, and the internal `/design-preview` route were not separately reviewed.

## Steep overview composition and Impeccable polish — 2026-10-25

The user supplied a Steep style reference, then a screenshot asking for an oversized centered headline with charts around it. The desktop Overview now follows that composition: a bar chart of recommended roadmap units by semester, a line chart of the same eight-semester sequence, and a personal draft progress ring sit around the headline. Values are derived from the selected program's `catalog.courses`, `takenCourseIds`, and `plans`; none are fabricated. The peach progress card explicitly says the draft resets on refresh. Course rows below the opening retain direct detail and planning actions, while the term panel states whether offerings came from the database or a reviewed local snapshot.

The React providers, routes, catalog records, section selection, and assistant remain the integration boundary. `src/Workspace.tsx` owns the new Overview composition and data derivation; `src/steep.css` owns the visual layer. The supplied screenshot is treated as a layout reference, not a source of claims or UI copy. A restrained wash behind the hero and shadow only on floating data cards translate the reference without using a static image of product data. This preserves live interactions at the cost of some additional Overview-specific CSS. The Impeccable polish pass removed the generic three-card milestone section, fake avatar/cursor decoration, invented upward deltas, and the prior headline about “warm paper”; the secondary navigation is now plain linked rows instead of numbered feature cards. `DESIGN.md` and `.impeccable/design.json` record the built system, and `.impeccable/surfaces/src-workspace-tsx.md` now points to the current reference instead of the older Ventriloc direction.

The working directory is the checkout of `https://github.com/mthinhngn/cmpe131`; local `HEAD` and remote `main` both resolved to `8ccee9d9247ac168120a24c588354f1875c86530` at this review. The pre-existing uncommitted work in this checkout was preserved. No commit, push, pull request, or deployment was made.

Motion follow-up: inspected the live Steep website on 2026-10-25. Its first scroll visually reduces and fades the hero while a product view rises into prominence; this is a visual inference from the rendered site, not a claim about its source code. The Course Radar translation uses a one-time title/artifact entrance, bar rise and line draw, then a CSS scroll-timeline fade/scale of the hero copy and view-timeline arrivals for the working sections. The header stays visible while scrolling. Browsers without CSS scroll timelines retain the static layout. A zero-percent progress ring no longer shows a stray arc dot.

Verification: visually inspected the local browser at 1440 × 900, including the opening and course section; checked no horizontal document overflow at that width (`scrollWidth` 1430, viewport 1440); clicked Plan for CMPE 30 and observed the progress ring change from 0 to 4% and units from 0/93 to 4/93; then reloaded to restore the neutral preview. At 405px of scroll, the hero copy had 0.46 computed opacity; by 900px the working course section was visible with the header still present. `npm test` passed all six existing schedule tests, `git diff --check` passed, and the final `npm run build` completed successfully after the motion changes. Desktop is the requested review surface.

## Restore GitHub frontend — 2026-10-25

At the user's request, restored the frontend tracked files under `src/` and `index.html` to the repository's `main` commit `8ccee9d9247ac168120a24c588354f1875c86530`. The local `HEAD` and remote `main` resolved to the same commit before restoration. This brings back the repository's original Overview, navigation, typography, colors, and CSS imports without changing the catalog providers, backend, tests, or repository history. The untracked Steep stylesheet, design-system document, sidecar, and Steep-specific Impeccable surface brief were removed from their active locations after being copied into `tmp/ui-before-github-restore-2026-10-25/` alongside a binary diff of the former tracked UI. Older entries in this report describe prior iterations; this entry records the currently active interface.

Verification: `git diff --exit-code -- index.html src` returned no content differences against the commit, `npm test` passed all six schedule tests, and the restored Overview rendered in the local browser at `http://127.0.0.1:5173/` with the original “Make room for what’s next.” heading and status panels. `npm run build` was started after restoration; its result is recorded in the final handoff.

## Ventriloc-inspired desktop redesign — 2026-10-25

The user supplied a Ventriloc style document and screenshots, then specified the document's structure as the first priority and the circular degree chart as a priority feature. The new Overview follows the document's split hero: a large regular-weight headline and two actions at left, and three offset white data cards at right. The cards show course distribution by recommended semester, completed course count, and a circular progress breakdown. Every value is computed from the selected catalog and current in-session completed/planned state. The ring labels completed, planned, and unmarked course options and says it is not an official degree audit. No Ventriloc business claims or partner marks were copied.

The shared `src/editorial.css` layer gives all six working routes the same warm paper, graphite type, ash panels, centered pill navigation, square dark actions, hairline rules, and restrained persimmon/brass accents. `src/Workspace.tsx` owns the Overview composition and ring data. Existing routes, catalog and schedule providers, search, course-detail drawer, planner controls, graph interactions, assistant state, and official-source links remain connected to their existing logic. `DESIGN.md` records the translated layout and component system for future work.

The user allowed creative color variation, so the palette is related to the supplied reference instead of an exact token copy. We kept the reference's page structure and spacing hierarchy while using Course Radar's academic data as the visual content. An extra CSS layer limits risk to existing behavior, but it leaves some cascade duplication until a future consolidation. Google Fonts supply the PolySans substitute; offline rendering falls back to system sans.

Verification performed: `npm run build` passed after the first full stylesheet pass. Live desktop browser review at 1440×900 covered Overview, Course explorer, Degree roadmap, Semester planner, Prerequisites, and Recommendations. Opening CMPE 30 in Course explorer, marking it completed, and returning to Overview changed the ring from 0% to 3%, the completed count from 0 to 1, and completed units from 0 to 4. The preview was then reloaded to clear that test state. Final typecheck/build and desktop review were repeated after the ring and documentation changes. Mobile was outside the user's requested scope. No commit, push, PR, or deployment was made.

Live-preview correction: the user found the corners too square. Softened buttons and form controls to 7–8px, working panels to 10px, and prerequisite nodes to 6px while preserving the pill navigation and the ring chart. Rechecked the Overview in the local browser after this CSS change.

Impeccable hook triage: the new `editorial.css` font warning is a reference-sanctioned exception. The supplied design document explicitly names Inter Tight as the PolySans substitute; a file-scoped `overused-font=Inter` ignore records that choice. The active desktop chart and conflicting schedule block now avoid thick side accents. Historical side-border findings in `workspace.css` and `styles.css` remain in those earlier stylesheets; they were marked attribution unknown and were not rewritten as part of this desktop corner adjustment. The live visual layer overrides their main-screen treatments.

## shadcn/ui source reference for agents — 2026-10-25

Added the official `https://github.com/shadcn-ui/ui.git` repository as a shallow, sparse local checkout in `.references/shadcn-ui/`, initially at revision `481d523374745e77d0cf9c53a4115ab5dd7c8481`. It includes the component registry, chart examples, content documentation, shared app helpers, and upstream MIT license. Root `AGENTS.md` points future agents to `docs/UI_COMPONENTS.md`, which explains source discovery, selective adoption, dependency inspection, license preservation, and adapting components to the existing Course Radar design.

`npm run ui:sync` recreates the source reference if absent and verifies an existing checkout; `npm run ui:sync -- --update` fetches upstream main and checks out that revision. The script validates the origin and refuses an existing checkout with local modifications. `.references/` is excluded from both Git and Vercel uploads, so the upstream monorepo is not bundled with Course Radar. The script makes this local setup reproducible without a nested Git submodule.

This is a source-reference integration. No shadcn components have been mounted in the app and no Tailwind migration was performed. The current app uses plain CSS, so future component adoption must translate utility styling or deliberately configure Tailwind and aliases. Installing the full upstream monorepo would add unrelated application/tooling dependencies; copying only required components keeps the current UI and dependency graph controlled.

Verification: `npm run ui:sync` completed successfully and printed the expected revision; `node --check scripts/sync-ui-reference.mjs` passed; the actual button source and MIT license were readable; `git check-ignore` confirmed the reference files are ignored; and `git diff --check` passed. No UI code changed, so no browser or production build was required for this setup.

## Above-the-fold Overview fit and Emil Kowalski design-engineering polish — 2026-10-25

- **What changed and affected files:** Updated `src/editorial.css` and `DESIGN.md` after reviewing the codebase against `emilkowalski/skills` (`emil-design-eng`, `animate`, `apple-design`, and `break-ui`) and the user's Ventriloc opening-window screenshot.
- **Above-the-fold opening fit (`100dvh` budget):** Reduced top vertical chrome (`workspace-header` from `104px` to `70px`, `workspace-context` from `54px` to `38px`, `data-message` from `33px` to `24px`, and Overview top content padding from `52px` to `clamp(10px, 1.5dvh, 20px)`). Rescaled `.overview-hero` (`min-height: calc(100dvh - 152px); max-height: 700px; align-items: center`) and compacted the three-card cluster (`.hero-data-cluster` from `625px` to `432px` total height, with a `106px` progress ring instead of `195px` and `92px` bar plot instead of `132px`) so the full headline, copy, CTA actions, and all three staggered data cards are visible in the opening window without scrolling on standard laptop/desktop viewports.
- **Emil Kowalski design-engineering refinements:** Added custom easing tokens (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`), `:active` tactile press feedback (`scale(0.97)` over `160ms var(--ease-out)`), a `50ms`-staggered entrance (`translateY(8px)` + `opacity: 0`) on the three Overview data cards, `@starting-style` drawer slide-in (`--ease-drawer`) and origin-aware dropdown scaling (`transform-origin: top left`, `scale(0.95)`), `@media (hover: hover) and (pointer: fine)` hover gating, `tabular-nums` on numeric labels, and a targeted `@media (prefers-reduced-motion: reduce)` rule that strips transform motion while keeping opacity/color transitions.
- **Alternatives and trade-offs:** Hiding the degree/context bar or snapshot notice on Overview would have freed another `60px` of vertical height, but was rejected because `PRODUCT.md` requires keeping the active program selector, catalog year, and snapshot disclaimer visible. Instead, tightening the chrome and card internals achieves a single-screen opening without sacrificing product truthfulness.
- **Data flow and verification:** Data flow is unchanged (pure CSS + documentation update). Ran `npm run typecheck`, `npm test`, and `npm run build` to verify no regressions.

## Interactive Prerequisite Chart redesign with `@xyflow/react`, `shadcn/ui`, and Impeccable — 2026-10-25

- **What changed and affected files:** Redesigned `src/PrerequisiteChart.tsx` and its visual system in `src/editorial.css` using `@xyflow/react` (`v12`), adopted four `shadcn/ui` primitives (`src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/native-select.tsx`, plus `src/components/ui/ui.css`) from `.references/shadcn-ui` (`481d523374745e77d0cf9c53a4115ab5dd7c8481`), and applied the `impeccable` skill's `Operate` mode and `craft-floor.md` requirements.
- **Technology and architectural pattern (`@xyflow/react` + Barycentric Swimlane Layout):** Replaced the hand-calculated `getBoundingClientRect()` SVG overlay with `@xyflow/react` (`ReactFlow`, `ReactFlowProvider`, `Background`, `Panel`, `Handle`, `useReactFlow`). Courses within each semester are ordered via a deterministic barycentric pass so prerequisite chains align vertically/horizontally with minimal edge crossings. Custom `semesterLane` and `courseNode` React Flow nodes keep semester headers and course cards synchronized during pan, zoom, and `fitView` camera transitions.
- **`shadcn/ui` component adoption (`docs/UI_COMPONENTS.md`):** Copied and adapted `Card`, `Badge`, `Button`, and `NativeSelect` (`NativeSelectOptGroup`, `NativeSelectOption`) from `.references/shadcn-ui/apps/v4/registry/new-york-v4/ui/` into `src/components/ui/`, retaining upstream URL, commit revision (`481d523374745e77d0cf9c53a4115ab5dd7c8481`), and MIT license notices. Translated Tailwind utility classes into plain CSS (`src/components/ui/ui.css`) mapped to `DESIGN.md` tokens (`Graphite #24231f`, `Paper #ffffff`, `Warm canvas #f7f6f2`, `Ash #f0efeb`, `Persimmon #db623b`, `Brass #907047`, `Mist #dedbd2`).
- **Direction-aware path tracing & Impeccable craft rules:** Hovering or selecting a course now distinguishes **upstream prerequisites** (Brass `#907047` animated edges + `Prerequisite` badge), **downstream unlocked courses** (Persimmon `#db623b` animated edges + `Unlocks` badge), and **corequisites** (Graphite dashed edges + `Corequisite` badge). Docked the live Relationship Inspector (`Card`) directly above the graph canvas with interactive course chips and gateway course shortcuts. Removed the banned eyebrow kicker above `h1`, eliminated `>1px` colored side/top borders and diagonal red strike-throughs on nodes, and kept normal page scrolling unblocked (`zoomOnScroll={false}`, `panOnScroll={false}`).
- **Alternatives and trade-offs:** Kept `@xyflow/react` focused on the Prerequisite Chart rather than replacing simpler static layouts on other routes. Disabled wheel-zoom hijack so scrolling down the page feels natural, providing explicit `+`, `−`, `Fit view`, orientation (`Vertical rows` / `Horizontal columns`), and curve style (`Orthogonal curves` / `Direct curves`) controls in the canvas toolbar.
- **Data flow and verification:** Course data, prerequisite/corequisite edges, completion marks, and the `<CourseDetail>` drawer data flows are unchanged. Verified with `npm run typecheck`, `npm test`, `npm run build`, and live HTTP/DOM checks against `http://127.0.0.1:5174/prerequisite-chart`.

## Prerequisite map visual direction — 2026-10-25

- **What changed and affected files:** Updated `src/PrerequisiteChart.tsx`, `src/editorial.css`, and `DESIGN.md` to follow the user's reference screenshot: course cards arranged in semester lanes, flowing arrowed connections, and unrelated courses fading while a path is focused.
- **Visual decisions:** The map now uses a faint 36px warm grid to read as an academic planning canvas. Cards and lane corners are softened to 10–12px, course nodes have more room for long SJSU course titles, and each semester header names both its course count and unit total. Smooth Bezier paths are the default, with rounded line caps; the alternate elbow routing stays available. The upstream/downstream/corequisite colors and card labels still reflect the recorded catalog relationships.
- **Interaction and data flow:** Existing course selection, hover/focus tracing, subject filters, panning, zoom, fit-view, orientation switch, and course-detail drawer are preserved. Focused paths remain strongly visible while unrelated cards fade, matching the requested example. Catalog and session state continue to supply all chart content; no relationship or availability facts were added.
- **Alternatives and trade-offs:** Retained year/semester swimlanes instead of replacing them with an undifferentiated force graph, so users can still read the suggested degree sequence. Increased node width and height for readability; this makes the map canvas larger and relies on its existing pan, zoom, fit-view, and page scroll controls. The warm grid adds an intentional map surface while remaining subordinate to the course cards and paths.
- **Verification:** Reviewed the live local chart at a 1440×960 desktop viewport, used fit-view, toggled between both path routings, and focused ENGR 100W to verify that its upstream prerequisite and downstream unlock paths stand out while unrelated courses fade. `npm run build` completed successfully; Vite reported its existing large-chunk advisory. `git diff --check` passed. The Impeccable hook returned no new findings. Mobile review was outside this desktop-only request.

## Course hover preview — 2026-10-25

- **User-reported defect:** Hovering a course emphasized its graph path but only changed the relationship inspector above the canvas. At a scrolled course card, that inspector was out of view, so no nearby information appeared.
- **Change:** `src/PrerequisiteChart.tsx` now opens a course preview next to the hovered card. It shows course identity, units, state, directly mapped prerequisites, unlocked courses, and corequisites. Keyboard focus opens it immediately; clicking still opens the full course drawer. A portal positions the preview in viewport coordinates so graph clipping and zoom do not scale it. `src/editorial.css` provides a soft paper surface and short entry motion, and `DESIGN.md` records the interaction.
- **Interaction reference:** Followed [Emil Kowalski's design engineering skill](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md): first hover has a 140 ms delay, moving to another course shortly afterward is immediate, keyboard focus is immediate, and the entry transition is 140 ms. The preview does not capture the pointer or block graph interaction.
- **Verification:** TypeScript/Vite build and whitespace check were run. Live browser hover verification was unavailable because local browser use is disabled in Work settings; desktop mouse behavior remains to be visually confirmed.

## Ventriloc-inspired landing page — 2026-10-25

- **Result and routes:** `/` now presents a dedicated Course Radar landing page in `src/Landing.tsx` and `src/landing.css`; the previous personal Overview remains available at `/overview`. Its content follows the supplied Ventriloc composition: split hero and overlapping product previews, quiet CE/SE program scope, alternating course/dependency/semester/week sections, and a focused closing action. The workspace routes and their data flows remain in place.
- **Product imagery and behavior:** React renders course rows, a recorded prerequisite chain, a roadmap semester, and a weekly schedule from the existing 2026–2027 catalogs and Fall 2026 offerings. The weekly illustration selects sections without time conflicts and labels the snapshot clearly. Visitors can switch the previewed program, filter real courses in the landing search, enter the existing explorer with that query, and replay the hero assembly. The AI scheduling section describes proposals as options for student review. Official SJSU requirements, session-draft limits, and dated section data are disclosed.
- **Architecture and trade-offs:** The landing styles are scoped under `.lr`, including a reset for the older global `main` container. Native React Router links, semantic buttons, and a labeled search field cover the required controls. The local shadcn/ui button reference was reviewed under `docs/UI_COMPONENTS.md`; no new primitive or dependency was necessary. Existing `DESIGN.md` remains the workspace system; landing-specific decisions are in `docs/surfaces/landing.md`. No stock imagery, generated rasters, statistics, testimonials, commits, or remote writes were added.
- **Verification performed:** `npm test` passed six schedule tests. `npm run build` completed after the final landing changes; Vite retained its existing large-chunk advisory. `git diff --check` passed. Browser inspection at 1440px and 1280px desktop widths found no horizontal overflow. Live checks confirmed CE/SE selection, empty and matching search states, a course link arriving at `/courses?q=…` with the selected program, retained `/overview` navigation, and computed replay animations of 1.2–1.55 seconds. An independent desktop screenshot review returned `ship` for the Ventriloc-inspired composition. Its minor clipped meeting-time finding was corrected and visually recaptured in `tmp/landing-review/week-1440.png`.
- **Limits:** The requested acceptance surface is desktop only. Mobile behavior, keyboard and screen-reader traversal, exact computed contrast, external font loading while offline, live backend catalog connection, and actual AI schedule generation were not validated. The Impeccable source detector reported four `overused-font` warnings for Inter Tight; that font is the user's explicit PolySans substitute in the supplied reference, so the design retains it. Its source scan does not validate rendered contrast or tiny text.

## Overview aligned with the landing — 2026-10-25

- **Result and architecture:** `/overview` now continues the landing's warm paper, ash surfaces, graphite actions, orange/brass accents, regular Inter Tight headings, DM Sans controls, matching logo and 1200px alignment. `src/Overview.tsx` owns the compact introduction/progress panel, searchable course working area, guidance rail and interactive semester distribution. `src/overview.css` scopes this treatment, including shared chrome under `.workspace-overview`; `src/Workspace.tsx` re-exports the new Overview. Progress and course views derive from `CatalogContext`; the existing course drawer and providers retain completion, semester plans and section selection.
- **Trade-off and component reference:** The compact progress panel and interactive course table replace the former full-height three-card dashboard so students can act on courses sooner. Program/catalog context, backend snapshot status, session-state limits and official-source guidance remain visible. The upstream shadcn/ui button and existing adapted button were inspected under `docs/UI_COMPONENTS.md`; native filters, search and semester selection needed no new primitive or dependency. `docs/surfaces/overview.md` records this surface contract. The incumbent broader `DESIGN.md` and `.impeccable/design.json` were preserved during the documentation pass.
- **Desktop review:** Independent finish review returned `ship` after inspecting complete-page captures at 1440×960 and 1280×900 (`.impeccable/review/overview/desktop-1440.jpg` and `desktop-1280.jpg`) against `landing-reference.jpg`. Typography, material, page ground, header/context, course working area, guidance and distribution matched the chosen direction; no material fixes remained. The detector's Inter Tight warning remains a user-pinned reference exception, not a new system rule.
- **Verification performed:** The implementation build passed, all six schedule tests passed, and `git diff --check` passed. The final build rerun after the CSS refinement also passed (TypeScript and Vite). Browser checks confirmed CMPE 30 completion updates progress to 1/31 (3%) and 4 units; ENGR 10 planned for Semester 2 appears in “In plan”; no-match search recovers through “Show all courses” to 31 courses, and CMPE 50 search matches; CE/SE switching changes totals to 31/30; selecting Semester 2 in the chart displays 15 units; and CMPE 30 section #47820 carries into the explorer's weekly schedule. Escape returned focus to the invoking course button. Test completion, plans and section selection were cleared afterward. Neither desktop width had page-level horizontal overflow. Computed list entry (450ms) and progress-ring transitions (650ms) remained perceptible with the actual OS reduced-motion preference, following the user's motion preference.
- **Limits:** Acceptance and visual review cover desktop only. Screen-reader use, full keyboard traversal, live catalog backend and actual assistant generation were not verified. Vite's existing large-chunk advisory remains.

## Prerequisites aligned with the landing — 2026-10-25

- **Problem and result:** The prerequisite page's large program title, scattered tools, and reference-heavy introduction did not continue the new landing page. It now has a regular-weight editorial introduction, the landing's warm paper and brand, graphite planner action, and a consolidated focus/filter/legend workspace above the map.
- **Architecture:** `src/PrerequisiteChart.tsx` retains the catalog context, graph generation, React Flow controls, hover previews, relationship inspector, course detail drawer, and planning state. `src/prerequisites.css` scopes the composition and shell styling to this route. No new UI primitive or dependency was added; the existing adapted shadcn Button/NativeSelect components were reused after reviewing the upstream reference source in `.references/shadcn-ui/`.
- **Trade-offs:** The map canvas uses the calculated height for the active orientation so React Flow can measure and fit its graph; the outer page remains bounded by the viewport and scrolls through long semester layouts. Pan, zoom, fit, focus selection, direction switching, textual relationships, and full details remain available. Shared application styling and data modules were not rewritten. Existing graph fit/zoom, hover/focus fade, and preview transitions carry the interaction motion.
- **Verification:** `npm run build` passed (Vite warns about the existing large application bundle); `npm test` passed all six schedule tests; `git diff --check` passed. Impeccable detector ran once against the initial changed TSX/CSS and returned `[]`; it was not rerun after the desktop-only scope cleanup removed mobile styling. Browser checks exercised CMPE 50 gateway selection, full details, semester planning, completed-course marking, subject filter and reset, orientation and edge style switching, zoom/fit, and both program selections. Inspected the 1440x1000 desktop capture. Capture: `.impeccable/review/desktop.png`. The independent review found the desktop composition and style aligned with the landing; its only open finding concerned mobile framing, which is outside the requested scope.
- **Limits:** Catalog connection fell back to the reviewed snapshot; no live backend or enrollment verification was performed. This was a focused UI pass, not a full application or assistive-technology regression suite. Existing unrelated working-tree changes remain in place.


- **Follow-up from desktop screenshot:** The user screenshot showed the Course connections canvas collapsed below its heading. Restore the orientation-derived `canvasHeight` as an inline canvas height, which gives React Flow a concrete measurement area for its nodes, edges, grid, and toolbar.
## Degree roadmap aligned with the landing — 2026-10-25

- **Result and affected files:** /roadmap now continues the landing and Overview workspace treatment. src/Workspace.tsx applies the shared capsule header and program/context bar, while src/App.tsx replaces the duplicated roadmap header and summary hero with a compact introduction, source review strip, searchable/filterable working area, and four year sections pairing fall and spring. src/roadmap.css scopes the visual changes to this route.
- **Data and behavior:** Course/term totals and filter counts derive from the selected catalog, plans, and takenCourseIds. Search includes course code/title and requirement-choice descriptions. Every named course still opens the existing CourseDetail drawer for prerequisite/corequisite information, completion, planning, offerings, and section selection; source and snapshot status remain visible. Requirement choices remain intact and visually distinct.
- **Trade-off:** Pairing two semester columns under each year shortens the long catalog while preserving every course row and requirement choice. The existing shared workspace context bar now owns degree selection, so the duplicate selector and brand header were removed from the page body.
- **Visual review:** Inspected the rendered localhost route at a 1440×960 desktop viewport and a full-page capture. The first viewport showed the common header/context, source note, controls, and first-term content; the full capture showed all eight semesters. The rendered data source remained the reviewed local snapshot and the live-catalog status stayed visible.
- **Limits:** No production build or automated tests were run. Filter interactions and the course drawer were not manually exercised. Mobile was outside the user's requested scope.
- **Surface contract:** docs/surfaces/roadmap.md records the layout, data invariants, interaction boundaries, and review scope.

## Complete Tailwind landing migration and soft corners — 2026-10-26

- **Scope and result:** Converted the entire landing from `.lr-*` CSS selectors to literal Tailwind v4 utility recipes in `src/landing.styles.ts`, consumed by `src/Landing.tsx`. Removed `src/landing.css` after searching `src` for remaining imports and selectors. Existing content, routes, data sources, preview selection, search, program selection, and CTA destinations remain. The latest explicit soft-corner request supersedes the pasted prompt's square-button requirement: controls use 8px, asymmetric panels use 10px/4px corners, and data previews retain 12px.
- **Tailwind architecture:** Added `tailwindcss` and `@tailwindcss/vite` 4.3.3 plus `@types/node`. The Vite plugin is configured in `vite.config.ts`; dev/build/preview explicitly select that file because the checkout contains an ignored stale `vite.config.js` which Vite otherwise selects first. Root and app TypeScript configs and Vite resolve `@/` to `src/`. `src/theme.css` imports theme/utilities only, omits global Preflight, scans source files, and prefixes utilities with `cr:`. Important utilities override unlayered legacy rules only where the migrated classes are used.
- **Tokens and remaining CSS:** Theme CSS owns the requested Graphite, Canvas White, Ash, Fog, Ivory, Steel, Slate, Mist, Ember, and Brass values, alongside the incumbent landing's calibrated aliases. It also contains display/body families, type sizes, spacing, corner tokens, and the existing four keyframes. These theme definitions and keyframes intentionally remain CSS; all landing layout, responsive, hover, focus, selection, and motion application use utilities. Dynamic schedule top/height percentages remain data-driven inline geometry. Existing workspace CSS, Google Fonts loading, and `src/components/ui/ui.css` remain intact.
- **shadcn foundation and adoption:** Configured the official manual existing-project foundation through `components.json`, opt-in `data-course-theme` semantic variables, and `src/lib/utils.ts`. Added `clsx`, `tailwind-merge`, and `class-variance-authority`; `cn` understands the `cr` prefix. `npx shadcn@latest info` successfully recognized Vite, Tailwind v4, aliases, theme CSS, and the four existing primitives. Consulted `docs/UI_COMPONENTS.md` and the local upstream button source at revision 481d523374745e77d0cf9c53a4115ab5dd7c8481. No new primitive was needed: semantic links/buttons/input remain appropriate. Existing primitives, source references, and license notices were retained. No upstream monorepo installation or default shadcn theme was applied.
- **Compatibility and small build repair:** Before integration, saved desktop screenshots and computed-style samples for all six workspace routes. After integration, samples matched exactly for `/overview`, `/courses`, `/roadmap`, `/prerequisite-chart`, `/planner`, and `/recommendations`, including sampled fonts, padding, backgrounds, radius, and widths. Typecheck exposed four pre-existing optional `courseId` lookups in the edited roadmap; minimal `?? ""` guards preserve missing-record behavior and allow the required build gate to run. No roadmap styling or data-flow redesign was performed.
- **Browser verification actually performed:** Inspected the current desktop before migration and the migrated page at 1440px; inspected/captured 390px wrapping and confirmed no horizontal overflow there. Confirmed CE/SE selection, empty-search feedback, matching CMPE 131 results, Tab focus with a brass 2px outline, and Enter navigation to the existing course explorer with the query and selected Software Engineering program. Captured all six workspace routes before and after integration. Evidence and JSON comparisons are under `tmp/tailwind-migration/`. No remaining `.lr-*` selectors or `landing.css` references occur in `src`.
- **Limits and future work:** Browser use became disabled in Work settings during the final replay check; the final animation behavior was not re-exercised. The existing replay remount, data-driven reveal observer, timings, and keyframes are carried into Tailwind. A full hover audit, screen-reader audit, live backend/AI execution, offline fonts, and visual checks beyond the sampled browser are unverified. Workspace routes and their existing CSS primitives can be migrated selectively later using this foundation. Production build retains the existing large-chunk advisory. No commit, push, deployment, or PR was performed.
- **Final check record:** The standalone project typecheck passed. The complete production build includes the TypeScript check and Tailwind/Vite compilation; schedule tests and the whitespace check were rerun in the same final validation sequence. Configuration recognition was checked with the official shadcn CLI. A subsequent semantic-token correction keeps `bg-muted` available for future shadcn components while preserving landing text through `text-subdued`.

## Landing art direction, typography references, and limited palette — 2026-10-26

- **Result:** Restyled only the landing, preserving the left-copy/right-product hero and all three preview functions. Source comparison confirms the complete CourseRow/PathPreview/SemesterPreview/WeekPreview block is unchanged. Catalog data, query links, program selection, search, state providers, and workspace routes are retained.
- **Typography and spacing:** Locally hosted Instrument Serif regular/italic and its SIL OFL are in `public/fonts/`. AgentBrain screenshots inform typography only. The old repo's live `src/workspace.css` was read: Crimson Pro / Atkinson Hyperlegible role separation, 1.55 prose leading, readable-scale overrides, and tight related groups inform the new rhythm. The current hero uses a uniform 68px serif scale, 62px below 1100px and 52px below 480px, with 1.05 leading. Italic does not enlarge the final word. Hero body is 17px/1.55; section titles 34–42px; body 15px/1.6. Explanatory spacing is about 88px instead of the previous 95–115px. Product UI remains sans.
- **Palette and surfaces:** Exactly five color families: paper #f7f6f2, charcoal #292a30, rust #b84b2b, amber #f3bf67, white. Preview text/border/fill colors are consolidated into opacity variants of these families. No green tokens remain in active landing recipes. Light exploration, a charcoal path chapter, pale amber semester chapter, white week chapter, and amber close create rhythm. Buttons/fields retain 8px corners, previews 12px, hero backing 18px. No old navigation, cards, colors, or composition were imported.
- **Motion:** CSS stages path, semester, and week at 0/340/680ms with 700ms transforms/opacity. Connector and calendar-block effects reinforce the sequence. Replay remounts preview wrappers only, preserving the button for stable focus. No animation dependency or infinite loop was added. Hover movement is fine-pointer gated. Project OS-motion policy remains unchanged.
- **Architecture:** Changed `src/Landing.tsx`, `src/landing.styles.ts`, `src/theme.css`, `DESIGN.md`, and `docs/surfaces/landing.md`; added two font binaries and their license. Existing Tailwind prefix, opt-in theme, no-Preflight boundary, and shadcn foundation remain. No new primitive, dependency, route, workspace stylesheet, provider, or data change.
- **Reference evidence:** Old source: https://github.com/mthinhngn/cmpe131/blob/main/src/workspace.css, read live on 2026-10-26 and saved under `tmp/landing-art-direction/`. Instrument Serif font binaries came from Google Fonts; license: https://github.com/google/fonts/blob/main/ofl/instrumentserif/OFL.txt. Both binaries were verified non-empty TrueType fonts. Source palette contrast: rust/paper 4.76:1; amber/charcoal 8.49:1. These calculations are not a rendered contrast audit.
- **Verification and limits:** Project typecheck and six schedule tests passed. Production builds passed during implementation; the final build result is recorded below. Source checks compare protected preview functions and the five-color families. Local browser review was attempted twice but is disabled in Work settings. No fresh screenshot, measured desktop/mobile wrapping, keyboard/hover flow, or motion-feel review is claimed. Prior screenshots in `tmp/tailwind-migration/` depict the previous design. Live desktop visual acceptance remains unverified. No commit, push, deployment, or PR.
- **Final gate result:** `npm run build` passed on the final source (TypeScript + Vite/Tailwind; existing large-chunk advisory). Six schedule tests passed. `git diff --check` passed. Source assertions confirmed all three hero preview calls remain, the protected preview function block is unchanged, no separately enlarged italic hero word remains, and all landing color literals resolve to the five documented families.

## Landing rail tightened to reference framing — 2026-10-26

- **User-reported issue:** The landing still left too much horizontal whitespace on wide desktop screens. The supplied reference begins its hero copy materially closer to the left edge than the previous 1360px rail.
- **Change:** Increased the landing-only maximum rail from 1360px to 1580px with an 80px minimum outer gutter. Existing 48px and 32px gutters remain at the 1100px and 800px breakpoints. Workspace routes were not changed.
- **Trade-off:** The wider rail gives the hero previews more room and reduces side whitespace on large screens, while preserving the existing two-column composition and data-preview overlap. At narrower widths the breakpoint gutters remain explicit rather than allowing uncontrolled edge-to-edge content.
- **Verification:** Re-rendered the local landing in the desktop browser after the CSS update and visually checked the hero framing, program strip, and course explorer alignment. Typecheck, schedule tests, production build, Impeccable layout detection, and `git diff --check` remain the relevant gates; no mobile or accessibility audit is claimed.


## 2026-10-26 — New Steep landing

### Implemented

The attached Steep reference replaces the earlier landing visual direction. Concept: connected courses become a clearer path. White paper, graphite, locally licensed Instrument Serif regular/italic and DM Sans, paired pill actions, flat mist panels and one peach assistant panel. The hero uses two exactly equal desktop columns. Its right half contains a real CMPE 30 → CMPE 50 → CMPE 131 relationship, with Path / Semester / Week controls and explicit replay.

The catalog demo searches real Computer Engineering records, announces result counts, opens prerequisite conditions, and adds/removes courses from a local plan. Empty search and empty plan states are implemented. Weekly examples select real, scheduled, non-conflicting offerings from the dated Fall 2026 snapshot. The week is intentionally independent of the demo plan and says so. Assistant content describes review-before-apply without pretending to run a live request.

### Architecture and affected files

- `src/SteepLanding.tsx`: new route component and local demo state. `src/main.tsx` changes only its landing import; all route paths and providers are preserved.
- `src/landing.css`: new scoped visual and responsive system; `src/theme.css` remains the existing prefixed Tailwind/no-Preflight foundation.
- `DESIGN.md`, `.impeccable/design.json`, `.impeccable/landing-steep.tokens.json`, `docs/surfaces/landing-steep.md`: current landing documentation. Existing workspace composition guidance is retained. Historical landing brief is marked superseded.
- Original `src/Landing.tsx` and `src/landing.styles.ts` are retained as inactive history. The original component file was locked during a write attempt; the new component avoids that contention.

### Decisions and trade-offs

The user-pinned Steep direction supersedes the first attachment's general accent-color freedom. Instrument Serif is a locally available, licensed editorial alternative; commercial Signifier/Sohne are not falsely claimed as installed. Native links/buttons/input are sufficient; reviewed local shadcn button source did not justify adding Radix dependencies. No new package, image generation, stock imagery, testimonial or fabricated academic outcome is needed.

Motion has one purpose: explanation of prerequisite progression. CSS stroke-dashoffset draws the connector over 2.6s, course artifacts arrive at 160ms intervals with the animate skill's ease-out curve. Replay remounts the current experience. Reduced motion preserves a readable static chain. Hover transforms are fine-pointer gated.

### Verification

Verification results will be appended after the final build, interaction checks and independent Impeccable review. No commit, push, deployment or PR is performed.

## 2026-10-26 — Connected paths landing redesign

### Implemented

The landing route now renders `src/ChronicleLanding.tsx` and its route-scoped `src/chronicle.css`. It replaces the former section sequence with an editorial opening, an interactive prerequisite graph, a shared-state semester preview, a searchable catalog table, a concise assistant workflow and a final workspace entry. The graph selects from real catalog courses for Computer Engineering or Software Engineering, highlights recorded prerequisite ancestry, shows the course's official requirements link, supports zoom/replay, and adds the course to `CatalogContext`'s session plan. Catalog add/remove controls update that same plan. The week preview is explicitly illustrative and leads to the real section workflow. The previous landing implementation remains inactive; workspace routes retain their existing components and data flow.

The user requested a Deep Ocean blue revision for the desktop graph. The diagram now uses `#0b4b5e` as its ground, `#082f43` for the inspector, and pale blue-green nodes and paths. Typography uses the self-hosted Inter Tight and DM Sans files; no new dependency or fabricated marketing proof was introduced. `DESIGN.md`, `.impeccable/design.json`, `PRODUCT.md`, and page metadata now describe the new direction and factual landing journey.

### Architecture and trade-offs

The diagram is a curated, selectable slice of each recorded roadmap rather than a second implementation of the full React Flow workspace chart. This keeps the landing legible and fast while the full map remains one click away. It reads the active catalog, program and plan from `CatalogContext`, so database-backed records can replace the local reviewed snapshot and the plan remains shared with the workspace. The week preview stays illustrative because the landing does not run section selection or conflict resolution; its label and link direct students to the real scheduling view. Native links, buttons, select and search input cover this surface, so copying a shadcn primitive or adding dependencies was unnecessary after inspecting the project's component guidance and upstream button source. Motion is a replayable CSS path draw and staggered node arrival, with a page control to turn it off.

### Verification and limits

`npm run build` passed after the initial implementation and again after the final Deep Ocean revision (TypeScript plus Vite). In the running page, the graph, planner and other sections rendered on desktop; adding a course updated the shared semester preview; program switching changed the graph and inspector; catalog empty search produced a recovery message; and the week toggle changed the preview. Mobile width was checked for horizontal document overflow before the user narrowed the focus to desktop. An old stylesheet class collision was discovered visually and fixed by changing every landing class prefix to `cx-`; the corrected white and blue desktop render was inspected. The subsequent Deep Ocean palette revision and documentation still require a fresh desktop screenshot because local browser control was disabled during the final visual pass. An independent Impeccable reviewer was dispatched, but that review did not complete because its usage limit was reached. No live assistant call, official catalog audit, or cross-browser test was performed. No commit, push or PR was created.


## 2026-10-26 — Prerequisite atlas redesign

### Direction and implementation

The prerequisite route is now a graph-led course atlas. A compact editorial heading and an integrated search/filter strip sit directly on a large Deep Ocean map. The initial camera frames the first two recommended semesters at a readable scale; the remaining rows are reached by dragging the canvas, zooming, or selecting a course. A small legend remains attached to the map, while a concise reading area below it exposes immediate incoming/outgoing relationships, course status, catalog details, and gateway courses. The shared Workspace header, program selector, source link, session data message, and CourseDetail planning/section behavior remain in place.

`src/PrerequisiteChart.tsx` keeps the real catalog relationship construction and React Flow integration. It removes the horizontal semester-column layout and connector-style switch. One vertical semester layout uses React Flow's curved Bézier edges. Hover and keyboard focus emphasize the complete transitive upstream and downstream path, fade unrelated courses and edges, and open the existing portal-based course preview beside the node. Hover changes styling only, so graph coordinates and camera remain stable. Deliberate selection from the course finder or related-course controls pans to that course. The independent traversal visited sets allow a course on both sides of a dependency chain to be explored in both directions.

`src/prerequisites.css` supplies route-scoped canvas, node, control, legend, relationship and desktop breakpoint styling. The 236×142 course nodes have readable code, title, units and course status. Transitions affect opacity, color and shadow for state clarity; portal preview entry and rapid course switching retain the existing short timing. Reduced motion disables the graph state transitions. No new package or shadcn primitive was added: the existing React Flow, button, badge and native select are adequate; the upstream shadcn chart source uses Recharts and is not a fit for a navigable dependency graph.

### Trade-offs and limits

The map begins with the opening semesters rather than fitting all eight into an unreadable overview. A Fit control still exposes the whole topology on demand. The map draws recorded roadmap-to-roadmap relationships only; catalog detail retains the omitted grade, placement, major-standing, GE, alternative-course and external-course conditions. Subject filters dim unrelated cards while preserving spatial orientation. Desktop widths below 1320px tighten tool spacing; mobile redesign is outside this request.

### Verification

TypeScript and production Vite build passed before the final legend adjustment; the final build result follows below. All six existing schedule tests passed. `git diff --check` passed. Impeccable's static `detect --json` returned `[]`. The dev server at `http://localhost:5173/prerequisite-chart` returned HTTP 200, and its stylesheet endpoint returned HTTP 200. Browser-driven visual and interaction checks were attempted, but the separate in-app browser reported “Local browser use is disabled in Work settings”; the native Chrome window was being used on an unrelated page, so no rendered screenshot, desktop-width measurement, hover, keyboard, popup, zoom or course-detail exercise is claimed. The independent Impeccable source review and correction pass completed. No commit, push, deploy, or PR was made.

### Final source review and correction

An independent Impeccable source review found four material issues, all corrected and scored resolved in a second source pass: connection/arrow colors now match the ocean-map legend; the portal preview remains pointer-accessible across the node-to-popup gap with a guarded close timer; the relationship reading separates directed prerequisites/unlocks from symmetric corequisites; and the redundant empty-state eyebrow is removed. This is a source verdict, not a rendered visual verdict. Native vertical page scrolling remains available over the map; dragging pans the graph. The graph shell also carries an inline viewport-based height, preserving a definite React Flow container even if route CSS order changes; this addresses the previously reported blank-chart failure.


## 2026-10-26 — White prerequisite diagram revision

### Plan

1. Replace the ocean map with a white dotted canvas and quieter neutral controls. Remove filled semester bands; retain compact semester labels for orientation.
2. Center course rows in a stable top-to-bottom composition, with curved prerequisite arrows and visible connection ports. Preserve real catalog records, filters, shared program/plan state and CourseDetail.
3. On hover or keyboard focus, raise the selected card gently and show its contextual preview. Emphasize downstream paths in green and upstream requirements in brass, dim unrelated content, and keep positions and camera stable.
4. Verify the live desktop route and interactions where browser access permits, run tests/build, and document actual evidence and remaining limits.

The user's white-background instruction supersedes the earlier ocean treatment for this route only. The reference informs node/connector behavior; its workflow labels are not copied.

### White diagram implementation and verification

Implemented the white canvas revision in `src/PrerequisiteChart.tsx` and `src/prerequisites.css`: white page/map, subtle dot grid, transparent semester rows with compact labels, centered courses, visible connection ports, green downstream paths and brass upstream paths. Course hover/focus raises the card by 3px with a 1.025 scale; event handlers stay on the fixed wrapper so the motion does not relocate graph geometry. The initial zoom floor is 0.9 to prioritize readable cards; narrower desktops may require horizontal panning. Hover does not move the camera. Edges stay below nodes and directional arrow colors match the legend. The existing preview and CourseDetail integrations remain.

Extracted path traversal into `src/prerequisiteGraph.ts` and added `tests/prerequisites.test.mjs`. All three targeted tests passed: transitive branching without unrelated siblings, traversal through a corequisite that is also a prerequisite, and cycle termination/clearing focus. All six existing schedule tests passed. Production build passed during this revision; final-source rebuild is recorded below. Impeccable source review flagged low-contrast small labels, corrected to #657169 on white. The follow-up reviewer hit its usage limit, so no independent final verdict is claimed.

Browser access was retried after the user reopened the preview; the tool still reports “Local browser use is disabled in Work settings.” Consequently, multiple desktop widths, actual hover feel, popup placement, keyboard navigation, filter and zoom interactions, and course-detail opening have not been visually exercised in this revision. These remain acceptance checks, not claimed passes. No unrelated route was redesigned, and no commit, push, deployment, or PR was made.

The portal preview now has a route-specific class with higher selector specificity, preventing the shared editorial stylesheet from restoring `pointer-events: none` through import order. The final combined test run passed all 9 tests; whitespace validation passed.

Final production build passed (TypeScript + Vite, 4773 modules). Vite retains its large-bundle advisory. The final preview selector is present in the generated assets.

## 2026-10-26 — Initial full prerequisite overview and gesture zoom

### Changes and architecture

`src/PrerequisiteChart.tsx` now fits every measured node, including all eight semester lanes, when the map opens. React Flow's `useNodesInitialized` and viewport dimensions replace the fixed 80ms delay and first-two-semesters fit. A topology signature resets the overview on degree/layout changes; hover, completion, and subject emphasis do not reset the camera. Explicit course search still focuses its selected course. The zoom range is 0.05–1.5; wheel and pinch zoom are enabled, and the entire zoom/fit button panel is removed. The map caption explains the gestures.

`src/prerequisites.css` gives the canvas an explicit viewport-relative height (`clamp(320px, calc(100dvh - 440px), 860px)`) so the desktop opening view includes the full graph and its legend. Removed unused route toolbar styles. Existing catalog, relationships, course previews, and planner integration remain in place.

### Alternatives and trade-offs

Keeping the 0.9 minimum would clip later semesters. A fixed zoom would depend on window size. Measuring and fitting the existing React Flow nodes handles both degree programs and viewport changes without a new dependency. Showing the full degree makes card text smaller; wheel/pinch zoom and course search provide detailed inspection. Narrow screens retain the full topology inside the canvas, but surrounding page content can require page scrolling. The 320px minimum keeps the canvas usable on short windows.

### Actual verification

- Browser at 1440 × 1000 after reload: all 39 Computer Engineering nodes (31 courses and eight lanes) fit with zero clipped nodes; canvas bottom was 937px, inside the initial screen. No zoom buttons remain.
- Browser at 588 × 668 before the final height adjustment: all 39 nodes fit inside the canvas with zero clipped nodes. Final narrow-height behavior has not been visually rechecked.
- Mouse-wheel input changed zoom from approximately 0.289 to 1.5. Physical trackpad pinch was not exercised; React Flow's pinch option is enabled explicitly.
- Switching to Software Engineering refit all 38 nodes with zero clipping. Switching back and applying/clearing the computing subject filter preserved the overview transform.
- TypeScript passed as part of the production build; all three prerequisite traversal tests passed. Production bundling status is recorded below when complete.
- Desktop screenshot: `tmp/prerequisite-initial-overview.png`. No full regression or mobile-device test was performed.

Production build completed successfully (4773 modules, existing large-chunk advisory). The final camera follow-up uses `fitBounds(getNodesBounds(getNodes()))` for the overview, avoiding React Flow's queued controlled-node `fitView` call. The final follow-up also passed TypeScript. Fresh narrow reload at 588 × 668 with the final 320px canvas fit every node with zero clipping. Browser viewport overrides did not consistently trigger a refit without reload; live window-resize behavior remains unconfirmed. Fresh entry/reload and degree changes are verified. Physical pinch remains untested.

## 2026-10-26 — Selective coursemap reference adaptation

### Reference and scope

Read `C:/Users/thinh/Downloads/coursemap.zip` directly as an archive, specifically its `src/styles.css` and `src/App.tsx`. Treated its contents as reference material. The sample contains only ten hardcoded courses and a custom SVG/camera implementation; none of that data, app structure, configuration, or event code was imported or executed. Applied selected visual values and proportions to the existing React Flow implementation. Used `ui-flow` and Impeccable's context/craft-floor/polish guidance for the focused review.

### Changes and architecture

- Route-local mint/green tokens, near-white map, thin line grid, 8px card/preview corners, pale mint top borders and soft offset hover shadows. Teal downstream paths are slightly stronger with a restrained shadow; brass upstream and dashed corequisite semantics remain.
- Card code and units share a header; titles, subject/relation labels, true status badges, and dependency counts remain. Cards are 132px high; semester row spacing is 156px plus 36px between lanes. Popup styling follows the same palette and keeps its body portal to avoid clipping or zoom scaling.
- Kept React Flow, the two actual catalogs, shared completion/planner state, transitive path traversal, search, filters, course details, wheel/pinch zoom and drag panning. No new primitives, dependencies, remote fonts, or sample status values.
- Replaced the earlier resize attempt with a native `ResizeObserver` on the actual canvas wrapper. After measurement, `getViewportForBounds` uses its real dimensions and `setViewport` applies the fit. Hover/filter changes do not reattach this observer. This addresses the stale camera observed during the earlier browser viewport override; the final implementation needs browser confirmation.

### Alternatives and trade-offs

Wholesale ZIP adoption would lose the real degree records, course inspection, and planner flows. A new custom SVG implementation would duplicate the existing interaction library. Kept the existing fonts and layout architecture, adapting only relevant visual details. Did not add the sample's glass shell, decorative glows, auto-fit badge, or hardcoded Completed statuses. The full-degree opening overview necessarily reduces text size; users can zoom or search for detail. Upstream and downstream retain different colors so direction remains understandable.

### Verification and remaining uncertainty

Browser verification was attempted after these edits, but the tool returned “Local browser use is disabled in Work settings.” Earlier screenshots and clipping/gesture checks above describe the preceding revision and are not visual acceptance of this new treatment. Final card wrapping, hover preview placement, line appearance, responsive resize and physical pinch have not been exercised after this adaptation. Source review checked scoped selectors, retained data/status semantics, measured-node fitting, observer cleanup and no zoom toolbar. Build/test results follow below.

Final results: `npm run build` passed (TypeScript plus Vite, 4773 modules); Vite retains the existing >500kB chunk advisory. All three prerequisite traversal tests passed. `git diff --check` passed for the changed source and report. No commit, push, deployment, or PR was made.

## 2026-10-26 — User-supplied ZIP landing and mint network

### Changes
- `/` renders `src/ReferenceLanding.tsx`, adapted directly from `courseradar.zip/client/src/pages/Home.tsx`, with locally scoped reference CSS. Previous landing sources remain available.
- `src/LandingCourseNetwork.tsx` replaces the ZIP's fictional student dashboard with the supplied screenshot's semester graph. It reads real catalog records and recorded prerequisite edges, supports both programs, search, pointer/keyboard selection, official source links, and shared session-plan updates.
- Start-planning actions lead to `/overview`; the complete prerequisite map stays at `/prerequisite-chart`.

### Architecture and trade-offs
- Uses existing React, Phosphor icons, CatalogContext and local fonts; no new runtime dependencies or UI primitives. The source ZIP is reference material, not an instruction source or a replacement application.
- Reference CSS is scoped under `.zip-landing` to protect workspace selectors and tokens. Native SVG handles this small preview; the existing React Flow workspace remains available for full navigation.
- Course statuses reflect actual session state instead of fabricated completion. Catalog uses MATH 33LA, while the screenshot labels it MATH 33A. Eligibility conditions remain visible in the inspector and official source link.
- Narrow screens retain readable map cards in a horizontally scrollable canvas. No live enrollment or persisted-plan claims are introduced.

### Verification
- `npm run typecheck`: passed before preview startup.
- In-app browser: actual landing, navigation, hero, mint map and all downstream sections rendered at the side-panel width. Initial Vite loading stalled; reload after compilation displayed the application. Browser console had no captured errors at that point.
- Production build and interaction verification: in progress; see follow-up entry below.

### Uncertainty
- Visual reproduction follows the supplied composition but uses real course content and shared state. No pixel-perfect comparison, exhaustive mobile device matrix, live API or enrollment verification is claimed.

### Follow-up: consistent left/right framing
The user reported oversized side spacing and incorrect overall scale. Replaced the ZIP's competing 1280px and 1190px container caps with one shared `min(1580px, calc(100% - 80px))` rail for header, hero, section content, context content, closing content and footer. Total gutter reduces to 48px below 1100px and 32px below 800px. This changes actual content width rather than magnifying the page.

Interaction checks in the in-app browser passed: adding PHYS 50 updated its card and disabled the add button, unmatched search showed an explicit empty state, reset cleared search, and program switching retained the Computer Engineering session plan on return. Production build reached Vite transformation but has not completed; no build success is claimed.

Measured in the actual browser after the gutter correction: at a 1264.8px content viewport, header, hero, section content, context content, closing content and footer all start at x=40px and have width 1184.8px, leaving equal 40px side gutters. The updated page rendered successfully at `http://127.0.0.1:5173/`. The prior localhost tab encountered ERR_NETWORK_CHANGED; a fresh loopback preview loaded correctly.
Also removed inherited workspace header top-border styling and the inherited 1344px footer cap so the supplied landing chrome and wide-screen rail remain consistent.

## Exact ZIP restoration — 2026-10-26 (supersedes the adaptations above)
The user rejected the custom map, shared 1580px rail, replacement fonts and spacing. Restored Home.tsx, CourseNetwork.tsx and index.css directly from courseradar.zip. The only Home source adjustment is its local CourseNetwork import path. Original 1280px/1190px rails, responsive gutters, Inter/Manrope/DM Mono fonts, Lucide icons, copy, dashboard preview and interactions are retained. The ZIP dashboard contains illustrative data, not the workspace catalog.

Architecture: separate dynamic document entries prevent workspace styles from loading on `/`, instead of trying to counteract their global rules. Workspace routes keep their providers and existing application. Navigation from a workspace back to `/` reloads the landing document to establish its isolated stylesheet set. No shared catalog, schedule or assistant implementation is changed.

Dependencies: lucide-react 0.453.0 and tw-animate-css 1.4.0 match the supplied source requirements. Fonts use the exact Google Fonts stylesheet requests in the ZIP. Font availability therefore depends on those requests succeeding. No custom design interpretation is applied.

Verification pending below: exact CSS/network source comparison, TypeScript, rendered comparison and targeted interactions. The earlier mint-map interaction checks do not validate this restored version.

### Exact-source and browser verification
- Compared against the ZIP archive itself: `reference-landing.css` and `LandingCourseNetwork.tsx` are byte-for-byte identical; `ReferenceLanding.tsx` matches Home.tsx except for its local import path.
- Served the original extracted Home and CSS independently on port 5175, using only a minimal React validation entry and the original font links. No original server/debug scripts were executed.
- Desktop comparison at a 1440x900 browser viewport: all 13 measured regions match exactly in x/y/width/height, including 1280px header/hero/footer rails, the headline, 1190px section rails, the 883.71875px product frame, and section boundaries. Browser scrollbar occupies 15px; the measured document content width is 1425px.
- Mobile comparison at a 390x844 viewport: the same measured regions also match exactly. Measured document content width is 375px with the scrollbar. The source's mobile list layout and menu are retained.
- Exercised original controls: course-list tab displays eight rows; unmatched search shows the source empty state; clearing search restores eight rows; map tab restores the graph; semester changes to Spring 2027; mobile menu opens and closes after choosing How it works.
- TypeScript passed as part of `npm run build` (Vite reached transformation). Production bundling completion is recorded separately below.
- Desktop screenshot: `tmp/zip-exact-desktop.png`. Comparison was geometric and visual; no exhaustive pixel-diff or live data integration is claimed. Original illustrative dashboard data remains exactly as supplied.

## 2026-10-26 — ZIP v2 split hero and right-edge treatment
User requested a desktop-only adjustment based on `courseradar (1).zip` and Chronicle's supplied reference. Imported the new ZIP Home, CourseNetwork hero variant and CSS; only the component import path changes in Home. Lower sections retain ZIP v2 composition. Hero copy stays left, the preview occupies the right column, and the hero extends past the centered header rail to within 24px of the right document edge. Original Google fonts and isolated document entries remain.

Architecture/trade-offs: desktop hero uses a full-width section with a left gutter aligned to the original 1280px rail and a 24px right gutter. A soft offset window shadow, non-interactive inner shade, and white edge wash create the requested depth and fade. The overlays use pointer-events:none; search, tabs, semester and graph controls remain the existing ZIP implementations. No new data flow or dependency.

Motion gate: rare page arrival; purpose is spatial consistency for the right-side window. CSS animation uses transform/opacity, 500ms and the existing --ease-precise token updated to the animate skill's strong ease-out cubic-bezier(.23,1,.32,1). Reduced motion uses opacity only; no hover movement was added. The map itself receives no new decorative movement.

Verification limitation: local browser automation returned 'Local browser use is disabled in Work settings'. No new screenshot, desktop visual acceptance or interaction result is claimed for this change. Build/type verification is recorded below. Previous geometry equivalence applied to ZIP v1 and is superseded for this intentionally adjusted hero.

Source verification passed: Home matches ZIP v2 except its import path, and CourseNetwork matches exact bytes. Formula-based desktop geometry at 1280/1440/1920px leaves a 24px right gutter; this is a source calculation, not a browser measurement. Vite reported ready on port 5173 and the preview was requested in Codex. The current production build remains in TypeScript compilation; no success is claimed yet. The preceding completed build was ZIP v1, not this change. User requested desktop only; no new mobile changes or validation were performed for this hero.

Follow-up: current TypeScript compilation passed; Vite proceeded to production transformation. TCP inspection confirms Vite listening on 0.0.0.0:5173. A loopback HTTP probe timed out in this environment, so the listener alone is not recorded as rendered or HTTP acceptance.

## Hero white fade and shorter window — 2026-10-26
User requested a white-to-pale-neutral Hero background and a broader fade over the right window edge, matching the attached Chronicle crop. Added CSS gradients only to the desktop Hero; no bitmap or external background is needed. Replaced the dark inner edge shade with a wider white/neutral wash and matched it to the Hero's right background. Both overlays remain pointer-events:none.

Reduced only the window viewport by 64–100px (8% of its width, clamped), roughly one semester row. Preserved the graph's former rendering height via its parent container width and the original window ratio; the map canvas scrolls vertically to reach lower semesters. The toolbar and inspector retain their sizes and stay outside that scrolling map. No course data/rows were removed and no transform scale, font-size or course-card size was reduced. At the smallest desktop width the 360px window minimum keeps the chrome usable.

Verification: the preceding split-hero production build completed successfully. Current change is CSS only; browser visual/interaction verification remains unavailable because local browser use is disabled in Work settings. Follow-up CSS parsing and production build results are recorded below. No new mobile styling was introduced.

Latest verification: PostCSS parsed the complete stylesheet successfully (415 top-level nodes). A fresh browser inventory attempt again returned 'Local browser use is disabled in Work settings'; no new render was inspected. Production build initiated for the current CSS change.

## Hero map footer overlap fix — 2026-10-26
Screenshot defect: the absolute legend and zoom controls remained attached to the scrolling map canvas after shortening it, overlapping Year 3 and the clipped CS 390 row. Introduced `.map-scroll` around the graph/content and `.map-canvas-footer` around legend/zoom. On desktop hero only, the map canvas is a flex column: graph scroll viewport above, dedicated 34px control footer below, and the existing course inspector outside both. The graph retains its prior dimensions. Added scroll-region keyboard focus/name and 24px trailing space so the last course can scroll fully above the control bar. Non-hero and narrow source layouts use display:contents wrappers.

Verification: targeted TSX and PostCSS parsing below; browser verification remains unavailable if Work browser permission is still disabled. This fixes the explicit overlap cause rather than reducing type/card scale. Source content is preserved; lower rows remain accessible through internal scrolling.

Targeted verification passed: TypeScript transpileModule reports zero TSX syntax diagnostics, and PostCSS parses the full stylesheet. A fresh browser access attempt still reports local browser use disabled; overlap removal is verified structurally, not through a new rendered screenshot.


## 2026-10-26 — Manus Prerequisite Map and browser corrections

### Changes
- Added `src/PrerequisiteMap.tsx` and `src/prerequisite-map.css`, serving `/prerequisite-chart` and `/prerequisites` through the landing document entry. Landing navigation/CTAs now lead to the dedicated page. Reused the landing radar mark.
- Restored the export frame label and existing Planning overview / Degree progress / Your path sidebar after the user identified their omission. Sidebar stays visible above 820px, with the shared narrow-screen course view below.
- Applied five browser comments: removed the heading description and entire back/catalog-link topline including its rule; shortened the heading to a single line; reduced dedicated course-card width from 190 to the export compact width of 150 SVG units.
- Preserved the original live/snapshot SJSU prerequisite graph at `/catalog-prerequisites`, including catalog providers, course inspection/completion/planning, and program selection. The example page links to that graph below its frame.

### Architecture and trade-offs
- Inspected active document entries, both graph implementations, existing workspace/catalog flows, the imported landing components and stylesheet, the ZIP route definitions, Home/Prerequisites/CourseNetwork sources, package metadata and assets. The ZIP contains an SVG brand asset and Manus debug plumbing; no debug scripts or new dependencies were adopted.
- The chart stays a single `LandingCourseNetwork` implementation with the existing `reference-landing.css`; the new stylesheet controls surrounding composition, viewport sizing and sidebar visibility. No parallel chart renderer, palette, course dataset or relationship model.
- Initial full-page verification confirmed identical SVG attributes/styles and identical dimensions at equal graph width. The user's later narrower-card instruction intentionally supersedes width identity on the dedicated page. Added an optional compact density using the export's 150-unit cards, with edge endpoints recalculated around each card center; default landing geometry remains 190 units.
- Preserved original node positions, semester groupings, labels, statuses, colors, fonts, shared hover/focus/selection, search, list, term and zoom behavior. The landing's edge-fade composition remains specific to its hero. The full page displays the complete map without that decorative page-edge wash.
- The supplied eight-course Computer Science plan and sidebar are illustrative. The page labels that clearly and retains access to the real SJSU catalog graph. Sidebar year rows are inherited static summaries; no working year-navigation claim. Session data is still provisional and resets on full document navigation/refresh as before.
- Motion gate: frequent Operate course exploration; no new decorative animation. Existing shared transitions remain; no new motion dependency.
- `docs/surfaces/prerequisite-map.md` records current scope. Root PRODUCT/DESIGN and sidecar retain pre-existing historical drift. The Impeccable launcher misinterpreted `/prerequisite-chart` as a filesystem root, so actual project context was read directly. The detector ran once and returned only advisory palette/type/radius warnings against historical DESIGN tokens; current landing and the explicit brief control this surface.

### Verification
- First implementation production build passed (`npm run build`, TypeScript + Vite). The final browser-comment revision is being checked separately below.
- Automated browser checks and screenshots live in `.impeccable/review/prerequisite-map/`; executable check is `tmp/verify-prerequisite-map.cjs`.

### Limits
- No live enrollment/API accuracy, external sharing sheet, real-device touch gestures or exhaustive regression claim. Existing catalog data and other workspace page designs were not redesigned.

Final browser-comment verification: `node tmp/verify-prerequisite-map.cjs` passed. Checked widths 1440, 1078 (user viewport 1078x668), 900, 820, 768, 390 and 320px with no document overflow or JavaScript page errors. All SVG computed styles and non-overridden attributes/positions match the landing; explicitly verified 150-unit dedicated vs 190-unit landing card widths. At matched graph width both SVG viewports measure 799.40625 x 402.703125px. Tested mouse selection/hover paths, Enter selection, zoom/reset, semester selection, search, list filtering/empty/clear and return to map, mobile menu, landing-to-page navigation, `/prerequisites/` alias and retained SJSU graph rendering.

Visually opened and compared desktop, landing, matched-width charts, mobile, tablet and user-1078 captures. Fresh independent Impeccable finish review disposition: ship, conditional on final build. It reviewed 1440/1078/900/768/390px captures and found no material new defect; it did not independently rerun interaction checks.

Final production verification: npm run build completed successfully after all browser corrections (TypeScript project compilation and Vite production bundling; 6319 modules, 1m 50s Vite phase). git diff --check passed for the touched tracked source files. Read-only documenter review confirmed this is an extension of the existing visual system; root review verified the sidebar breakpoint, example-data disclosure, retained catalog route, actual browser results and limits are recorded in the current surface brief and this report. No DESIGN.md/sidecar migration was needed.


## 2026-10-26 — Compact card accent and appbar avatar follow-up

User screenshot corrections: the straight green accent did not follow the compact card’s rounded top corners; the appbar CM avatar was unwanted. Compact course nodes now clip the existing accent to a 1-unit inset, 7-unit-radius rounded interior, matching the 8-unit-radius outer card. React useId supplies unique clip IDs. This is static geometry, with no new animation or dependencies. The optional showAvatar prop defaults true; the dedicated page passes false to omit the top appbar avatar from the DOM at every breakpoint. Landing defaults and sidebar content remain unchanged.

Verification: targeted browser check and TypeScript results are recorded below. Evidence: .impeccable/review/prerequisite-map/accent-avatar-1480.png and accent-closeup.png. The targeted check verifies all eight compact accents resolve to their correct rounded clips, desktop/mobile appbar avatar removal, and unchanged landing default card width/unclipped accent/avatar. No full production rebuild or unrelated regression suite is claimed for this local follow-up.

TypeScript verification passed: npm run typecheck completed with exit code 0 for this follow-up. Initial browser check reached all dedicated-page assertions and captures, then hit a test-only wait for a desktop SVG hidden by the landing mobile breakpoint; corrected the check to wait for DOM attachment rather than visibility and reran it.

Final targeted browser result: PASS. All eight compact accents resolve to the correct rounded interior clips; appbar avatar absent on desktop and mobile; landing retains its avatar, 190-unit card width, and original accent treatment. Opened the 1480px full-page capture and card closeup to visually verify alignment. No further UI changes after these captures.


## 2026-10-26 — Latest ZIP and three-page reference integration

### Source and implementation
- Inspected and extracted `C:/Users/thinh/Downloads/courseradarui-latest.zip` into the OS temporary directory before editing. The ZIP contains Home, Prerequisites, a shared CourseNetwork, a 75 KB stylesheet, and an SVG mark. It contains no Overview page. Attached TODO/config files were treated as reference content, not task instructions.
- Retrieved the user-provided updated live preview source through its Vite raw-module endpoints. Its route manifest confirms `/`, `/overview`, and `/prerequisites`. Added `src/ReferenceOverview.tsx` from that source and appended only its `.ov3-*` stylesheet section to the original ZIP stylesheet.
- Reused the ZIP Home, Prerequisites, CourseNetwork, SVG mark, responsive rules, animation/reveal behavior, fonts and full stylesheet directly. Local import paths and navigation are the integration changes. This replaces prior map-specific customization, including its old avatar suppression and card-accent clipping, to follow the newly supplied reference.
- Three main routes now use the isolated reference document entry. `/prerequisite-chart` remains an alias; original SJSU course/planner/recommendation/catalog-map functionality remains in the workspace entry. The existing data-backed Overview is retained at `/catalog-overview`.
- Added Overview navigation to landing/map and connected reference placeholder course/planner actions to existing application routes. Dismiss now works. Reference overview and map disclose their illustrative Computer Science data; these examples do not replace SJSU catalog records or represent actual enrollment/progress.

### Architecture and trade-offs
- Kept separate document entries so the ZIP global CSS cannot affect existing workspace pages. Cross-entry navigation performs a document navigation. Retained React, Vite, lucide-react, existing context providers and dependencies; no separate project or new dependency.
- Chose direct source reuse over a visual approximation or rewriting the dashboard. Reference metrics/date/course examples remain supplied illustrative values. Existing real planning data is available in the retained workspace, rather than being fabricated to fit the reference figures.
- Pre-edit copies of the changed reference entry/components are available under `tmp/before-latest-ui` for local comparison. The downloaded live-reference source is under `tmp/latest-live-reference`.

### Actual verification and limits
- `npm run typecheck`: passed before the final workspace navigation adjustment.
- `npm test`: 6 schedule tests passed. `node --test tests/prerequisites.test.mjs`: 3 prerequisite graph tests passed.
- Production build and final navigation checks are recorded below when complete.
- Visual/interaction verification is currently blocked: the browser tool reports `Local browser use is disabled in Work settings`; native-app inventory also timed out. No screenshot comparison, responsive runtime check, or interactive browser success is claimed for this revision. The user has requested the Work-settings browser for future previews.


Final validation update: production `npm run build` passed (6319 modules; Vite bundling 1m31s). Final `npm run typecheck` passed after the navigation/help-link changes. Source comparison confirms the ZIP stylesheet remains a verbatim prefix of the integrated CSS and CourseNetwork matches the ZIP except for its cross-page help link. The actual integrated app is served on port 5173; the previously opened 5175 tab belonged to an obsolete ZIP-check server and displayed an import error. Corrected the existing Work preview tab through native app control to `http://localhost:5173/overview`. Visually inspected Overview in the narrow side panel and expanded view, verified Dismiss removes the illustrative-data notice, followed Overview to `/prerequisites`, and visually inspected the rendered map. Returned the preview toward Overview. Browser-specific control still reports disabled, but native Work-window control became available after the user's settings change. These are manual checks of the observed desktop windows, not a pixel-diff comparison, mobile QA, console audit or exhaustive interaction regression.


## 2026-10-26 — Overview browser comments: green palette and chart composition

### Changes mapped to comments
1. Replaced the Overview purple/blue accent token and hardcoded link, ring, avatar, selection and timeline colors with the prerequisite map's teal `#168873`, evergreen `#183933` and pale mint `#a5d8c9`. Changes are confined to Overview selectors; ZIP landing/map styles remain unchanged.
2. Split header actions into `ov3-header-actions`. The shared `ov3-actions` rule previously applied the hero CTA's 25px top margin to the header; the header now has its own vertically centered flex group and no top margin.
3. Removed the requested illustrative-dashboard banner, its Dismiss state, and unused CircleAlert import. Reference dashboard figures remain the existing supplied sample values; this change does not connect them to actual SJSU planning state. The SJSU workspace link remains available.
4. Replaced absolute, overlapping chart positions with CSS Grid: a wide credit-composition panel above a larger degree-progress panel and a lower-offset current-term panel. The supplied Ventriloc image guides panel composition only; original course metrics, controls, and content are retained. No business metrics or financial chart data were copied or invented.

### Architecture and trade-offs
`src/reference-overview.css` contains readable layout refinements loaded after the reference stylesheet. Existing chart components and inline SVG remain reused; no dependency or new primitive. Grid keeps the reference's staggered panel rhythm without allowing panels to cover each other. Narrow layouts keep two panels until 420px, then stack all three. Header/navigation, section links, term selection and requirement expansion remain connected.

### Verification
- Native Work-browser screenshot inspection at the expanded desktop preview confirmed the green accent, aligned header, absent banner, and separated three-panel composition.
- Source assertions confirmed banner state/markup removal, isolated header actions, and removal of the former blue/purple accent literals from Overview CSS.
- Build and narrow-preview/interaction results follow below. No new test suite added for this reversible layout/color change.

Manual follow-up: inspected both expanded and narrow Work preview windows. The header's logo, navigation and workspace/avatar now share the same vertical center, the banner is absent, all three charts remain separate at both observed widths, and selecting Fall 2026 from the current-term dropdown updates its button label and closes the menu. This verifies the existing term-label interaction only; course figures remain supplied sample content. No phone-size, automated pixel comparison, or live-data check is claimed.

Final validation: npm run build passed (TypeScript project compilation plus Vite production bundling, 6320 modules, Vite 1m43s). Scoped git diff whitespace check passed. Updated DESIGN.md with the user-selected Overview palette and chart composition. Preview remains open in the expanded Work browser.


## 2026-10-26 — Academic trajectory milestone overlap

The browser comment targets `.ov3-timeline`. Its milestone dots were positioned 62px down inside a node already offset 38px by timeline padding, which placed them in the text lane; the connector was independently placed at 69px. Updated `src/reference-overview.css` to place the connector at 45px and node markers at 0px (active marker -2px) relative to the node, reserving a separate 30px lane before date/title copy. Retained all four terms, labels, colors and planner links. Below 760px, replaced the previous clipped 620px minimum-width timeline with a vertical sequence so each term remains readable. No application logic, data, dependencies or other page styles changed.

Verification: source geometry inspection confirms milestone centers and connector share the same lane, with text below. Browser validation follows below; no new tests added for this CSS-only correction.

Browser result: scrolled the expanded Work preview to Academic trajectory and visually confirmed all four milestone dots sit on the connector above the date/title/detail rows, with no marker/text overlap. The planner link remains visible. CSS brace-balance and targeted source checks passed. This was a CSS-only change; no production rebuild, phone-size runtime check, or unrelated regression suite was performed.


## 2026-10-26 — Overview primary button matches landing

Changed only the Overview hero primary CTA background to the landing `.button-dark` values: `#050505` normally and `#303030` on hover. Retained white text, the existing anchor action, sizing and green chart/navigation accents. Source comparison verifies both color values match the landing rules. CSS-only change; no new tests or production rebuild required. Browser appearance checked separately below.
Browser verification attempt timed out in get_window_state; the color match is verified from CSS source, not a fresh screenshot.


## 2026-10-26 — Overview planner link and button consistency

Removed only the extra Open semester planner link below Academic trajectory. Retained planner navigation and the closing CTA. Set both the hero Read your trajectory button and closing Open semester planner button to the landing primary button's 4px radius; closing CTA now also uses its exact black `#050505` and hover `#303030` colors with white text. Kept section layout, chart styling and button destinations unchanged. Source checks confirm the targeted timeline link occurred exactly once before removal and both color/radius values match landing `.button`/`.button-dark`. No new tests or production rebuild for these local markup/CSS edits. Browser verification follows if available.
Manual Work-browser follow-up: opened Overview and inspected the hero and closing CTA at the current narrow desktop window. Both buttons render black with softened corners; closing planner button remains visible. Timeline-link removal also verified in source. No full build or broad regression claim for this local correction.

## Restore shaded main landing — 2026-10-26
Live inspection found `/` still renders ReferenceLanding, but the approved desktop Hero shade/fade and shortened window CSS had disappeared from reference-landing.css. Restored that treatment in src/landing-hero.css, imported by ReferenceLanding, with a landing-home root scope. This is the main `/` landing, not a preview route. Preserved existing Overview/Prerequisites routes and their newer sources. Restored scroll/footer separation for the Hero graph so legend/zoom do not overlap semester rows. Restored rules retain the 24px right gutter, white-to-neutral Hero surface, right-edge white fade, existing card scale, shorter scrollable window, and reduced-motion-aware entry.
Verification: targeted TSX and CSS syntax parsing; browser rendering unavailable while browser automation is disabled. No visual confirmation is claimed.

## Connect page navigation to the main landing — 2026-10-26
Main `/` remains the shaded ReferenceLanding. Header and closing Start planning actions now lead to `/overview`; hero map actions lead to `/prerequisites`. Landing footer links expose Overview, Courses, Roadmap, Prerequisites, Planner and Recommendations. Overview navigation now opens the actual `/courses` and `/roadmap` routes rather than same-page sections, and includes Recommendations. Prerequisite navigation exposes Overview, Courses and Planner. Existing home-brand links return to `/`.

Architecture: retain normal document navigation between reference and workspace entries to preserve stylesheet isolation. The existing `/prerequisite-chart` alias, `/catalog-overview`, and `/catalog-prerequisites` remain. Vercel's existing index.html rewrite supports direct route loading. No hero/shade styling or catalog providers changed. Document navigation follows the current session-only model; state may reset across document navigation.

Verification: static link-to-route checks and TSX syntax validation below. Browser automation remains unavailable; click-through rendering is not claimed.

### Final navigation scope (supersedes expanded navigation above)
User clarified exactly three public surfaces: Home landing at `/`, Overview at `/overview`, Prerequisites at `/prerequisites`. Header navigation on these pages contains only Overview and Prerequisites. The top-left logo is the only Home link; footer home links and prerequisite Back to Home were removed/replaced. Start planning leads to Overview; map actions lead to Prerequisites. Removed outward links to catalog/workspace/Courses/Roadmap/Planner/Recommendations from these three surfaces and aligned affected CTA wording with its real destination. Existing legacy route implementations remain intact but are not exposed in this navigation. Main shaded landing is preserved. Targeted TSX syntax and static href checks performed; browser interaction not claimed.

## Browser comment 1 — remove closing microcopy (2026-10-26)
Removed the selected `.closing-foot` row containing “Clarity, course by course.” and “Made for students building what’s next.” from ReferenceLanding.tsx. The closing CTA and site footer remain. Verified the two phrases and closing-foot markup are absent from the active landing source. No browser render verification performed.

## Frontend design exports — 2026-10-26
Created exports/courseradar-design-2026-10-26/courseradar-frontend.zip (Home, Overview, Prerequisites) and courseradar-landing.zip (standalone shaded landing). Both include self-contained source/config, exact package versions, README, implementation report and compiled dist/. Landing-only links target sections, avoiding missing subpages. No backend, node_modules or secrets included. Each package passed strict TypeScript checking and Vite production build using matching installed dependencies. Each ZIP passed archive integrity checks. Fresh dependency installation and browser visual checks were not performed.

## Overview Next decisions icon - 2026-10-27

Removed the decorative Sparkles icon beside NEXT DECISIONS in the active ReferenceOverview and removed its unused import. The existing heading, spacing, decision content, and links are retained. This presentation-only edit uses the existing component and changes no state or architecture. Verified the rendered desktop panel contains its text heading and zero SVG icons; browser inspection at 1242px confirms the removal. No new tests or dependencies required.

## 2026-10-27 — Desktop degree roadmap extension

Redesigned `/roadmap` from the inspected Manus `degree-roadmap-only.zip`, using the live landing's radar mark, Inter typography and editorial white canvas with a route-specific green extension. Added connected year navigation, two semester branches, official group-title units, course nodes, native requirement-choice disclosures and all-year search/status filters. Existing `CourseDetail` retains real planning, completion, conditions and section/schedule flows; session state and official-source limits remain visible.

Architecture: `src/DegreeRoadmap.tsx` derives the view from `CatalogContext`; `src/roadmap.css` scopes plain CSS; `src/Workspace.tsx` supplies the local header treatment. A focused year keeps requirements readable compared with one huge eight-term map; all-year results preserve cross-year discovery. Connectors represent recommended sequence, not prerequisite edges. No new dependency or persistence change. Global `DESIGN.md` remains unchanged. The updated six-block direction contract and current limitations live in `docs/surfaces/roadmap.md`; this is a code-led preview without an approved comp.

Verification: typecheck passed; production build passed before the small header/condition-text follow-up; six schedule tests passed. Browser checks passed for Year 2 selection, course opening and marking completion. Screenshot evidence is limited to an 845×654 desktop side panel; full desktop-width review and final review remain pending. One detector run reported font/palette/type-ramp warnings against older design metadata; Inter intentionally follows the current landing. No mobile acceptance or exhaustive search/filter/planner regression is claimed.

Final verification update: the final production build passed after header/condition-text edits. Cross-year search returned CMPE 195A/B from Year 4 while Year 1 was selected. Final desktop hero/route captures are 1227×660 in `.impeccable/review/roadmap-hero.png` and `roadmap-desktop-route.png`. The finish reviewer verified the course-condition label fix and returned scoped ship; complete program/planner/filter regression remains outside that verdict.

## 2026-10-27 — Connect Degree Roadmap navigation

Added Degree roadmap links to the landing and prerequisite headers and the overview header, plus the landing/overview footers. Unified the existing planner link label. The existing `/roadmap` route already mounts the redesigned page, with workspace navigation providing return links. Kept normal document links between the reference and workspace entries to retain stylesheet isolation; no route/provider or persistence changes. This means cross-entry navigation retains the existing refresh-scoped state behavior. Verification: static navigation checks and typecheck below; browser click-through recorded separately.

Navigation verification: `npm run typecheck` passed. Static checks confirm roadmap links on Home, Overview, Prerequisites and Semester Planner. Browser click-through from Home to `/roadmap` and from roadmap to `/overview` reached the expected rendered pages.

## 2026-10-27 — Roadmap browser comments

Removed the shared catalog connection banner on `/roadmap` only, and removed the selected lower review/date/session sidebar including its prerequisite link. Kept the lower editorial copy and existing footer. Hero now states “Sourced directly from the official SJSU catalog.” This describes data provenance, not a live-fetch guarantee: CatalogContext uses the bootstrap API with reviewed local data as fallback. No fetching or planning logic changed. The bottom section becomes one column after removing the sidebar. Validation recorded after edits.

## 2026-10-27 — Full-sequence roadmap and course panel redesign

All four years/eight semesters now render initially. Year controls jump within the complete sequence, replacing progressive year reveal; search/filtering still covers all years. Reused CourseDetail through an optional roadmap variant with scoped `roadmap-detail.css`: white Inter/evergreen header, course facts/source, about, planning/completion, conditions, section snapshots and actions, professor reviews, and fixed official-source footer. Other routes keep their standard drawer. No new dependency or persistence behavior. A longer page makes the complete sequence discoverable without repeated clicks. Native controls and existing focus management were retained; nested semester-picker Escape now stops propagation.

Verification: build and all 6 schedule tests passed; final typecheck passed after the small Escape fix. Browser at1242x668 confirmed initial four-year presence, Year4 jump preserving all four years, Semester2 planning, LAB add/remove, complete/undo and plan clearing, Escape restoring focus. Independent finish review returned ship for desktop screenshots/code scope. Detector reported only older metadata palette/type/radius advisories. Unverified combinations and screenshots are in docs/surfaces/roadmap.md. Browser control later became disabled in Work settings; an app request to reopen `/roadmap` was sent without claiming renewed visual confirmation.

## 2026-10-27 — User reference palette and typography

Saved the five user-provided references as shared color/type guidance in DESIGN.md and its sidecar, then adopted them on roadmap and its detail panel. Added roadmap-palette.css with semantic teal, cyan, cloud, mist, slate and peach tokens and the existing self-hosted Instrument Serif face. Mapped recurring old roadmap colors to these tokens. Display headings become serif; operational course data and controls stay Inter. Alternate years use cloud, units/semester markers slate, flexible requirement choices peach, and the route cyan on deep teal. No new dependencies or behavioral changes. Other pages can adopt these documented tokens later; their CSS was not migrated in this task.

Trade-off: two type voices add editorial character while keeping dense planning information in a sans-serif. Flat colored roles replace a uniform green treatment; reference gradients were omitted to keep the map readable. Palette values are authored approximations of the references, not exact sampled source-brand specifications. Browser inspection is currently blocked by disabled local browser use in Work settings; rendered acceptance is unverified. Build/typecheck and contrast checks recorded below.

Palette verification: measured key contrast ratios: secondary-on-teal 6.51:1, primary-on-teal 9.26:1, body-on-paper 5.43:1, large secondary title 3.92:1, slate-on-light 5.63:1, peach-choice caption 5.19:1. The single detector pass reports font/type/color metadata advisories; no clean detector pass is claimed. `git diff --check` passed. Fresh visual review remains unavailable because local browser use is disabled.

## 2026-10-27 — Align desktop navigation across pages

User screenshots showed Overview's bottom teal rule, Roadmap's pill, Prerequisites without an active mark, and Planner's close underline. Added product-navigation.css to both document entries, using Planner's 72px/32px/44px/27px geometry and label-bottom underline with Overview's #168873. Removed active pills/shadows for desktop header nav and added aria-current on the Prerequisites link. This is a targeted CSS unification rather than a new header component, preserving route destinations and page-specific actions. Applies at >=1000px; mobile is outside scope.

Also fixed the palette import order identified by source review: Workspace now imports base roadmap, detail, then palette. Earlier order could let base CSS overwrite the approved serif/colors in production. Shared navigation loads after page CSS. Browser remains disabled, so no fresh visual acceptance is claimed; final bundle order/build checks recorded below.

## 2026-10-27 — Revert requested font changes

User explicitly rejected the font-style change. Removed roadmap Instrument Serif font-face declarations and restored Inter with prior heading sizes/weights/tracking in hero, year headings, route labels, closing copy and course detail title. Retained palette roles and navigation spacing/teal rule. DESIGN.md and sidecar record that serif adoption is withdrawn. No data or interaction changes.

## 2026-10-27 — Hero correction and bounded course inspection

Applied four new browser comments: hero title returns to #101010/#767676 like the existing landing, its description/action align to the start of the right grid column (rather than the far right), and copy reads “See the big picture. Choose your next move.” with official-source provenance retained. Course topic text strips the generated official-roadmap sentence; CMPE50 receives a concise topic summary instead of repeating catalog context. Other sourced descriptions remain available. Font remains Inter.

Changed the roadmap-only detail panel to an inset 560px inspection sheet with16px outer clearance,10px corners, compact24px title, quieter facts, and plain plan selects instead of a large tinted box. Existing about/plan/conditions/sections, sources and state logic remain. All four years/eight semesters remain visible.

Motion gate: occasional pointer-opened inspection uses spatial continuity; transform/opacity transitions200ms with existing strong ease-out,32px travel, symmetric pointer dismissal and timer cleanup. Keyboard opening/dismissal is immediate; reduced motion drops transform. No new package. Shared default drawers on other routes retain their styling. Browser use is currently disabled in Work settings; this pass has no fresh rendered or motion-feel verification. Production and source checks recorded below.

Final verification: production build (including TypeScript) and diff checks passed. Independent source review found no blocker in close-timer cleanup, keyboard dismissal or cascade precedence. Detector completed with design metadata advisories; visual/motion feel remains unverified due disabled browser control.

## 2026-10-27 — Annotated route shade, semester spacing and reliable panel arrival

Applied the exact #335C5D route-band color locally, with a static white/beige transparency overlay fading to green over80px. Light numeric discs keep readable dark labels, while year copy remains on green. Refined semester headers: plain sequence number,20px Inter term label,11px requirements count,14px regular unit total, tighter alignment and removal of repeated recommended caption. All eight semesters and catalog totals remain.

Replaced pointer entry reliance on starting-style with before-paint WAAPI:28px translate plus opacity250ms strong ease-out, backdrop200ms. Pointer dismissal captures the current transform/opacity, cancels arrival and animates outward200ms, retaining timer cleanup. Keyboard and reduced-motion behavior remain. No dependencies. Browser control remains disabled; no new rendered/motion-feel claim. Build/type verification follows.

## 2026-10-27 — Horizontal fade and relocated official guide
Changed the roadmap-only fade direction to left-to-right. Light left/dark right label styles preserve contrast across the four columns; no viewport-specific annotation values were copied. Moved Official guide from the roadmap header to the catalog row, retaining catalog.programUrl as the destination. Other workspace headers retain their guide action. Browser control remains disabled; visual verification unavailable.

## 2026-10-27 — Simplify roadmap completion marker
Removed the check glyph from completed course connection nodes and removed title strikethrough. Retained the green filled node and Completed text, preserving completion state and filtering. Scope is roadmap cards only; completion controls in course details remain functional. Source verification confirms removal; no browser rendering claim.

## 2026-10-27 — Soften year fade and repair header alignment
Spread the horizontal fade across most of the band with distributed opacity stops, removing the compressed central boundary. Darkened first-two-column copy for contrast. Removed roadmap-only right alignment after the header action removal so shared auto margins center navigation again. Active underline now uses the link bottom border, avoiding conflicting legacy pseudo-element rules;72px link height aligns it with the header edge. Shared desktop navigation behavior remains. Source/type checks below; browser unavailable.

## 2026-10-27 — Continuous full-width year gradient
Replaced the multi-stop alpha overlay with exactly two color stops spanning0–100%: #f5f0e6 to #335c5d. The darkest tone is reached only at the right edge. Changed Year3 copy to dark ink on the now-lighter middle ground; retained white Year4 copy. This is a local CSS correction without data or behavior changes. Source/diff checks performed; no fresh browser verification.

## 2026-10-27 — Restore completed course strikethrough
Restored line-through on completed roadmap course titles per user correction. Green completion nodes and Completed labels remain; check glyphs remain removed. Verified the scoped CSS rule in source.

## 2026-10-27 — Align gradient endpoint with connector
The horizontal fade now reaches #335c5d at the connector right endpoint,65px before the band edge; the remaining tail stays solid through the background color. A route-local --route-end-inset controls both connector endpoint and gradient width so they remain aligned at different widths. Verified source rule; no rendered verification.

## 2026-10-27 — Remove semester footer notes
Removed the degree-term-note paragraph from every roadmap semester per user annotation, including generic recommended-semester captions and term-specific notes. Underlying catalog descriptions remain unchanged. Verified shared rendering removal in source; no data or planning changes.

## 2026-10-27 — Prerequisite heading cleanup
Removed the YOUR COURSE MAP / 01 — 01 label row above the prerequisite-map title. Main heading and map behavior remain unchanged. Verified both strings absent from active PrerequisiteMap.tsx.

## 2026-10-27 — One landing-sourced header wordmark

Replaced independent header wordmarks in ReferenceLanding, ReferenceOverview, PrerequisiteMap, SemesterPlanner and Workspace with shared CourseRadarBrand. Removed the unused prerequisite RadarMark and Workspace CourseRadarLogo import. The source is the existing landing wordmark, not the old overview/planner approximations:27px radar mark,9px gap,15px Inter,600 Course/400 Radar,1.5 line height,-.055em tracking, exact original black/gray colors and SVG geometry. Shared CSS explicitly resets font/margins so page styles cannot change the wordmark. This covers all Workspace routes as well as public pages; footer variants remain unchanged.

Architecture/trade-off: a shared anchor component prevents per-route drift while keeping normal document navigation home and separate route styles. Navigation stays in existing page shells with shared label metrics. No new library or data behavior. Static source checks confirm the five header renderers all use the same component. Browser control is still disabled in Work settings, so computed/pixel equality has not been visually measured in this pass. Production/type validation recorded below.
\nHeader verification: production build including TypeScript passed; diff checks passed. Live computed-style and screenshot comparison remain unavailable because browser control is disabled.

## 2026-10-27 — Remove landing section counters
Removed only the three section-label counters01 — 03,02 — 03 and03 — 03 from ReferenceLanding. Preserved the corresponding labels, headings, feature-card numbers, content and layout. Verified all three requested counter strings absent from active source; diff check passed.

## 2026-10-27 — Remove footer secondary captions
Removed the landing footer tagline Make your degree make sense. and the Overview footer caption Workspace overview · Spring 2026. Kept footer branding, navigation and copyright. Verified both target elements absent from active source; diff checks passed.

## 2026-10-27 — Remove planner footer catalog status
Removed the planner footer status line (reviewed snapshot/loading/connected variants) and its Retry live catalog control as requested. Removed unused mode/retry bindings; footer branding and official requirements link remain. Catalog fetching/fallback behavior is unchanged. Verified target markup absent and diff check passed.

## 2026-10-27 — Balance landing closing section
Removed the YOUR NEXT SEMESTER, CLEARER kicker and unused Sparkles import. Balanced desktop closing-section vertical padding at43px above and below, and removed the21px heading top margin formerly separating the kicker. Existing smaller-screen padding override remains unchanged. Source/diff checks confirm the requested element removal and spacing values; no fresh browser measurement.

## 2026-10-27 — Course Explorer desktop: Manus reference integrated into the existing app

### Changes

- Replaced the `/courses` UI with `src/CourseExplorer.tsx` and `src/ExplorerWeek.tsx`; `Workspace.tsx` re-exports the new page. Other workspace routes, the landing, backend, catalog providers, and schedule provider were not redesigned.
- Used `C:\Users\thinh\Downloads\courseradar-site.zip` as reference material, extracting its App/CSS into `tmp/manus-course-explorer/`. ZIP SHA256: `B921AB185CA0E675C0B420C0EA582E6E54343098203DE74B8FBCC80618EB3709`. Its mock catalog, standalone build configuration, storage format, and embedded project documents were not imported as application behavior or instructions.
- Inherited the current landing's Inter typography, white/charcoal chrome, gray second headline line, hairline dividers, and mint/evergreen product canvas. Self-hosted official Inter with its OFL license in `public/fonts/`; the ExplorerInter family alias and route-scoped selectors prevent changes to other pages.
- Created an always-visible weekly workspace beside an expandable course catalog. Added ghost section previews, explicit confirm/cancel, calendar/agenda switching, schedule focus view, component-aware replacement, inline overlap feedback, selected-section removal, and unique-course unit totals.
- Preserved the complete existing CourseDetail dialog: prerequisites/corequisites, completion, semester planning/status, all sections, term selection, dates/class numbers, official sources, and professor links.
- Latest user scope is desktop only. Final design review and delivery are desktop scoped. Basic responsive fallbacks remain functional; this is not a mobile redesign delivery.
- Latest user correction restores the original Manus `01 / ONE SECTION / AT A TIME` hero detail and its exact dotted SVG path. It replaces the added secondary prose and remains static.

### Architecture and decisions

The page reads `useCatalog` and `useSchedule`, and all selection changes call the existing select/remove functions. Search/status continue to use URL query parameters. Existing browser storage stays keyed by program, catalog year, and term. Completion and semester plans retain their existing session-only behavior. No API, backend, persistence schema, enrollment rules, or catalog data was replaced.

A candidate preview excludes only the saved section with the same course and component. Lecture and lab remain independently selectable. Confirming uses the existing replacement semantics. Preview validation uses the proposed week; saved-week validation is computed independently from actual selections, so a clear proposal cannot conceal an existing saved conflict. TBA sections explicitly say that overlaps cannot be fully checked. Weekend and out-of-frame meetings remain supported by the existing parser and dynamic day/time bounds.

Chose a real scheduling workspace rather than the ZIP's chat-bubble calendar: time position, meeting duration, and overlap need a predictable grid. Kept the existing detail dialog instead of duplicating all academic controls in the catalog. Native disclosure buttons and grouped view/filter buttons were sufficient after inspecting the shadcn reference; no new primitive or dependency was needed.

Accepted trade-offs: the catalog scrolls independently to keep the week available; expanded courses disclose all recorded sections rather than hiding full sections; short or overlapping meetings may use local calendar scrolling to preserve legibility, and the agenda gives a complete text alternative. Desktop course/time text is 12px and component text 11px. There is no arbitrary credit target or fabricated scheduling assistant.

### Motion

Applied the requested ui-flow, animate, and impeccable skills. The authored motion confirms spatial placement: pointer-created calendar blocks enter with opacity and 6px travel/0.97 scale, using the existing strong ease-out curve over 160ms. Hover lift is restricted to fine pointers. Search/filter data stays immediate; keyboard-created blocks skip entrance motion. No animation dependency or perpetual decorative effect was added. Project ui-flow's existing reduced-motion policy was preserved.

### Verification actually performed

- Production `npm run build` passed after the structural/review fixes (TypeScript and Vite). The existing large workspace-bundle warning remains, approximately 516KB minified; unrelated code splitting was not undertaken.
- Existing `npm test`: all 6 parser/conflict tests passed, covering multi-day and composite schedules, TBA, overlaps, adjacent meetings, and separate weekdays.
- Enabled in-app browser: visually inspected current landing and the redesigned desktop page. Exercised real catalog search, empty-result recovery, filters, section disclosure, requirements dialog, plan semester/status, unsaved preview, confirm/cancel, lecture plus lab, lab replacement, unique unit totals, schedule removal, agenda, focus view, refresh persistence, and program isolation.
- Tested CMPE30/MATH30 overlap preview. Specifically saved conflicting MATH30 section02, previewed clear section10, and verified the UI simultaneously says preview clear and saved week has 1 conflict. Also exercised a BIOL10 TBA preview and its uncertainty warning.
- Final desktop screenshot inspection checked text sizes (computed 12px course/time), no horizontal document overflow at 1280px, and correct header placement. Browser console reported no captured warnings/errors in the final inspection. Test-added selections were removed; reload returned to the initial empty saved week.
- Impeccable finish reviewer initially requested separate saved/proposed truth, a direct preview journey, and larger operational text. All three were corrected; its verdict pass returned `ship` for those scored fixes within desktop scope. The documenter verified adoption of the incumbent system and left DESIGN.md/sidecar unchanged. Detector font/palette/size findings reflect stale frontmatter and generic Inter warnings; current landing and explicit user typography direction take precedence.
- After the user's final hero-detail correction: checked the restored copy/path visually and ran the TypeScript check again.

### Evidence and limits

Screenshots: `.impeccable/review/course-explorer/desktop.png` records the separate saved-conflict/clear-preview verification; `finished-desktop.png` records the final page with the retained hero detail. Earlier screenshots may include temporary test selections from real catalog records.

The API was unavailable during this session, so interaction verification used the existing reviewed fixture fallback. Live database/API behavior, enrollment availability, cross-device persistence, and exhaustive browser/assistive-technology coverage were not verified. Backend and provider code were left untouched. No commit, push, or PR was created.

## 2026-10-27 — Adjustable Explorer schedule and shared product context row

### Implemented

- Added `ExplorerPanels.tsx`: desktop split workspace with a draggable separator, keyboard resizing, double-click reset, full-week focus, schedule hide/show, and a narrow re-open rail that retains the selected-section count.
- Keep the schedule at least 560px wide and the catalog at least 340px while split. A saved split preference uses a separate `course-radar-explorer-split-v1` key; course selection storage and backend logic are untouched. Previewing a section automatically restores split view so a hidden calendar does not hide the result. Both panels stay mounted across desktop modes, preserving their internal view/state.
- Added only `react-resizable-panels` (4.15.0), after inspecting the official shadcn resizable source, its library API, and MIT license. `src/components/ui/resizable.tsx` records the exact shadcn source revision and retains the upstream license. Styling stays plain CSS and follows the approved landing/Explorer palette.
- Added `ProductContextBar.tsx` and `product-context.css` as the shared implementation of the Explorer row the user selected: Workspace/page breadcrumb, Degree, edition/year, and status. Adopted by shared Workspace routes (Explorer, roadmap, recommendations, legacy catalog routes), standalone Semester Planner, reference Overview, and Prerequisites. The landing is unchanged. Existing engineering program selectors still call the same provider; illustrative Overview/map retain their existing Computer Science data and honest labels instead of showing a selector that cannot change those illustrations.

### Decisions and motion

The screenshot's comparison handle is interpreted as a functional divider, not a before/after overlay: both course information and calendar must remain usable. Minimum panel widths prevent squeezing the schedule into an unreadable strip; the separate collapse rail is an explicit choice. Returning to split restores the prior ratio. Drag updates immediately without a spring or width transition because the divider must track the pointer. Keyboard view changes remain immediate. Pointer-driven panel reveal uses a 160ms opacity-only WAAPI transition with the existing strong ease-out token; it has no positional travel, including with reduced motion. Hover/active grip feedback uses scoped color transitions. No new motion library was introduced.

### Actual verification and remaining uncertainty

- Before browser access was disabled, the enabled in-app browser showed the new shared Explorer context row, splitter semantics, full-width collapsed catalog, re-open rail, and focus mode. Keyboard ArrowRight changed the separator from 41 to 46 percent; hide/show and focus buttons operated.
- That same interaction pass exposed inaccurate ratio restoration after changing panel constraints. The implementation now defers layout restoration until the panel registry has applied constraints. This correction and reveal fade were checked in source and TypeScript/build, but have not been re-exercised in the browser.
- The browser then returned `Local browser use is disabled in Work settings`, including after the user's request to open preview. No alternate browser or automation was used to bypass that setting. Final pointer drag feel, restored ratio, reload preference, and cross-route visual matching remain pending until browser use is enabled again. Do not treat earlier screenshots as verification of these final changes.
- `npm test` passed all 6 existing parser/conflict tests. The final production build runs TypeScript and Vite; its result is recorded below. The existing bundle-size warning is larger after adding the resizing library; no unrelated bundling migration was attempted.
- Code review checked that context component imports cover both reference and workspace entry trees, no duplicate Degree controls were introduced, and selection/provider APIs did not change. The existing UI flow and impeccable polish guidance were applied without starting another visual-identity workshop. No commit, push, or PR was created.

Final build result: PASS — TypeScript and Vite production build; workspace JS approximately 571KB minified / 155KB gzip, with a bundle-size advisory.

### 2026-10-27 — Continue schedule on/off refinement

The collapsed schedule now retains a live, textual saved-week summary in the desktop toolbar: selected-section count, time conflicts, or unknown meeting-time review. The same warning is exposed in the re-open rail's accessible name, so hiding the calendar does not hide schedule problems. Previewing a section still automatically reopens the split workspace. The toolbar is sticky below the 72px desktop header, keeping hide/show/focus controls available while scrolling. Re-opening from the rail by keyboard returns focus to the separator rather than leaving focus on a removed button.

This is a restrained continuation of the established design, not another page redesign: existing hero, `01 / ONE SECTION AT A TIME`, catalog, section selection, providers, and independent saved-versus-preview validation remain. The divider stays immediate during drag; only pointer-driven reveal has a short opacity fade. Width preference and course selections use independent storage keys.

Verification: the current Impeccable static scan of the panels, shared context component/styles, and resizable primitive returned only the existing Inter alias and inherited 3px/#168873 design-system warnings (1 warning, 2 advisories); these reflect adoption of the explicitly approved Explorer/landing system. Source review checked visibility, focus restoration, warning derivation, minimum constraints, and preview reopening. Browser reconnection was attempted again but still returned `Local browser use is disabled in Work settings`, despite the user's screenshot showing On. No alternate browser control was used. Final desktop visual/drag/width-restoration checks remain unverified; this limitation is not evidence of a failed build or failed schedule logic.

Continuation build: PASS — TypeScript and Vite production build (15.66s); existing workspace chunk-size advisory remains. Browser verification is still pending for the final refinement.

### 2026-10-27 — User-requested edge-to-edge divider

The latest request explicitly supersedes the minimum-width stops: both desktop panels now permit 0–100% widths. Pointer release within the final 3% snaps to the corresponding edge, avoiding a leftover sliver. The divider remains enabled at both endpoints, with its grip placed inside the visible edge and a 48px resize hit target. Home/End and arrow keys also work. Double-click restores the 41/59 default after the current pointer event finishes. Only nonzero split ratios are stored; dragging to an edge preserves the prior useful split. Schedule/course selection data remains untouched.

Browser access recovered this turn. The local dev server had stopped; restarted Vite on port5173 and opened a visible in-app preview. Verified actual pointer dragging to100% on the right and back to0% on the left, keyboard Home0/End100, reversal to5/95 with arrow keys, and double-click reset41. Captured edge-left.png, edge-right.png, and edge-preview.png under .impeccable/review/course-explorer/. Earlier minimum-width statements are historical and superseded by this explicit request. Production build passed before the final small edge-snap/hit-target fixes; final TypeScript check follows those fixes. No selection/persistence/backend changes. Preview is marked to remain open.

Final edge-divider TypeScript check: PASS. Preview reopened and visibly confirmed on /courses; tab retained for the user.

### 2026-10-27 — Exact user reference for divider appearance

Replaced the mint/dotted vertical grip with the supplied reference's thin #ffb800 line, white46x34px handle,2px amber border,12px corners and three fine gray vertical strokes. Removed the collapsed green schedule rail. The handle remains centered on the divider at both0% and100%, with overflow visible on the group and workbench so its outer half is not clipped. The line extends24px above/below the panel. Existing drag, keyboard, double-click reset, toolbar summary, selection and persistence behavior are unchanged; focus uses a separate accessible outline.

Verified the rendered reference style at both endpoints in the enabled in-app browser. Right endpoint is saved as .impeccable/review/course-explorer/reference-handle-right.png. TypeScript check passed after these changes. Restarted the local Vite preview server after discovering it had stopped. Preview left open at the right endpoint as requested. This explicit reference overrides the earlier mint handle/rail design; no other palette or page redesign was made.

### 2026-10-27 — Dark grid schedule reference

Added `src/explorer-schedule.css`, scoped exclusively to the Course Explorer schedule. The user explicitly supersedes the mint calendar ground with the attached developer-platform reference: #111111,116px major grid, dashed58px subdivisions, white display copy, cool gray operational text. The grid is a crisp repeatable SVG geometry authored in CSS, not a raster screenshot containing unrelated text. All schedule regions are covered: header, week calendar, empty state, agenda, preview, warnings, saved-section controls and footer. The catalog, landing, yellow divider, provider logic and persistence remain unchanged.

Kept Inter to match the reference's sans-serif construction and the product. Schedule headline now scales27–44px with its own panel width using container units; body summary14px, dates11px, meeting code/time12px, metadata11px. Dark tinted course states and explicit dashed previews retain readable contrast; warm warnings stay distinct. No decorative animation or new dependency was required.

Validation: TypeScript check passed. Enabled in-app browser visually inspected the full-width reference ground/title, split-view CMPE30 section preview (two ghost blocks, zero saved selections), preview cancellation, and agenda/week switching. No test selection was saved. Screenshot .impeccable/review/course-explorer/dark-grid-schedule.png; preview left open on the dark week. This was a presentation-only change; backend/API and exhaustive contrast/assistive-device testing were not rerun.

### 2026-10-27 — Clarify overlapping schedule grid borders

Fixed the user-reported double-grid confusion in explorer-schedule.css. The calendar time body and agenda now have an opaque #111111 ground, hiding the decorative116px/dashed background beneath functional data. The header retains the requested reference pattern. Day boundaries use #34373c and hourly rules a quieter #272a2f; removed the duplicate first-hour top border. The only grid within the calendar is now its actual day/hour geometry. No schedule data, markup, times, sizing, or interactions changed.

Verified visually in the enabled desktop preview: full-week calendar contains only aligned day/hour rules, with no competing dashed/major decorative lines. Agenda background is similarly quiet. CSS-only change; no extra tests needed. Screenshot: .impeccable/review/course-explorer/clean-time-grid.png. Preview remains open.

### 2026-10-27 — Link Course Explorer throughout product navigation

Added the existing /courses route to landing, reference Overview and Prerequisites header navigation, plus landing/Overview footers. Semester Planner's existing Courses link now uses the consistent Course explorer label. Shared workspace headers already link Explorer with roadmap/planner/recommendations, so no new route or duplicate application was introduced. Reference-entry boundaries retain full-document anchors; the router-owned Planner link retains React Router behavior. Added aria-current to Overview's existing active link.

Validation: TypeScript passed. Enabled browser exercised Explorer -> Overview -> Course explorer and Explorer -> Prerequisites -> Course explorer, checking the actual links and returned Explorer heading. Preview left on /courses. Landing/footer links inspected in source; not every footer link was independently clicked. No backend or persistence changes.

### 2026-10-27 — Catalog height and dotted schedule field

Removed the Course Explorer catalog's Semester Planner promo footer and expanded the desktop course list from 549px to 620px, giving the classes that space. The schedule title and term metadata now sit on a plain #111 ground. The time grid uses a subtle 12px dotted field based on the supplied image, with quiet functional day/hour borders retained for reading meeting positions. The catalog search, section actions, schedule calculations, and persistence are unchanged.

Source inspection confirms the footer markup and associated CSS were removed. TypeScript passed. The in-app preview could not be visually rechecked because local browser use reported disabled in Work settings; the Vite server was restarted, but visual acceptance of this final CSS remains pending.

### 2026-10-27 — Unified workspace frame and navigation labels

Aligned the Explorer catalog and schedule within one square outer border, removed the schedule's independent corner radius, and let the catalog list stretch to the shared bottom edge. Removed the obsolete decorative line-grid ground beneath the schedule's plain header and dotted calendar field.

All active product headers now consume `product-navigation.ts` in the requested order: Overview, Schedule (/courses), Course (/prerequisites), Planner, Roadmap, Recommendations. Landing and Overview footer navigation uses the same source. Existing document reload boundaries remain for reference routes. The shared context row removes the draft label and places its teal dot before Degree across Workspace, Overview, Course and Planner. Context breadcrumbs use the new page names.

Validation: TypeScript passed after the header/context/frame changes; source review checked shared consumers, route destinations, active links, and context props. In-app visual verification was attempted, but local browser use still reports disabled in Work settings. Final rendered border alignment and header spacing remain unverified. Schedule calculations, course data, and persistence were not changed.

User clarification supersedes the route mapping and frame sizing above: Schedule is /courses, Course is /roadmap, and Roadmap is /prerequisites. All shared menus follow that mapping. The desktop split workspace now has a bounded 820px height, one continuous rounded outer border, and matching clipped panel corners. Course rows scroll within the remaining catalog height rather than stretching the full list; the schedule scrolls inside its panel as needed. Both panels keep the existing 0–100% resize/collapse behavior and the amber handle. This is a frame correction rather than a request to display more course rows. Visual verification remains blocked by the browser-use setting.

### 2026-10-27 — Remove schedule toggle

Removed the toolbar's Hide/Show schedule button and its unused icon import at the user's selected target. The existing divider remains the collapse/reopen control; Focus on your week and Show catalog remain available. Source inspection confirms the toggle is removed. This localized removal adds no new behavior and requires no new test.

### 2026-10-27 — Remove Schedule header extras

Removed the Official guide header action and catalog connection-status row from /courses at the user's selected targets. The omitted row occupies no layout space, so the existing hero spacing now starts directly below the context bar. Catalog loading/fallback logic remains in its provider. Source review verified both route conditions; other workspace routes retain their current behavior. This targeted render-condition change was not visually rechecked.

### 2026-10-27 — Stable centered desktop navigation

Changed the shared desktop header from content-dependent flex spacing to three grid columns with equal side tracks and an intrinsic center track. Logo sits left, navigation stays at the exact header midpoint, and optional actions sit right. All active reference and workspace headers share these rules, so removing an action no longer shifts the menu. The 72px height, shared outer rail, typography, link order and active underline remain. Source review confirmed all four header families use the same selectors; browser rendering was not rechecked.

### 2026-10-27 — Match Overview content width across product pages

Added product-layout.css to both document entry trees. Desktop main content now follows the existing Overview rule: min(100% - 88px, 1380px). Schedule, Course, Planner and Recommendations expand to that rail; Roadmap's prerequisite map previously reached1440px, so its title and frame now align to1380px too. Workspace footers and source/status rows follow their main content rail. Header/context geometry and the landing composition are preserved, and widths below1000px retain existing rules.

The shared override has enough specificity to supersede route-local1280/1200px widths without migrating each page's internal layout. User screenshots and source inspection establish the width mismatch; the Impeccable layout detector reported no findings before edits. Final verification is recorded below.

Verification: final Impeccable layout scan of product-layout.css returned []. Source review confirmed both entry imports, higher specificity than route-local widths, and exclusion of the landing/Overview selectors. The1380px/88px formula matches Overview at the supplied wide desktop size and at1000–1380px widths. Browser access was attempted but returned Local browser use is disabled in Work settings; actual rendered widths, map refitting, and overflow remain unverified for this revision. CSS-only change; no new behavior tests were added.

### 2026-10-27 — Seamless single Schedule window

The latest clarification rejects an inset gray surround. Removed that padding and all panel corner radii: catalog white and schedule black now meet directly along the straight divider, enclosed by one14px rounded outer frame. The outer frame clips the two surfaces together. At either endpoint the amber grip shifts inside the visible frame so it remains reachable despite clipping. The divider line no longer protrudes beyond the shared window. Collapse logic and schedule data flows are unchanged.

Enabled browser verification recovered after resetting a stale browser connection. Visually checked the joined top edge and zero-gap seam; computed styles confirm outer radius14px, padding0, and both inner surface radii0. Home and End produced full-week/full-catalog modes and DOM geometry confirmed the grip stays inside the frame at both endpoints. Restored41/59 split with double-click. Screenshot: .impeccable/review/course-explorer/seamless-window.png. Preview retained. CSS-only correction; no additional behavior tests were added.

### 2026-10-27 — Confirmed inset schedule structure

The user explicitly confirmed that the catalog is the white host window and the dark schedule is a nested pane with all four corners rounded. This supersedes the preceding flush-seam interpretation. The right panel wrapper now has8px inset on all sides; its schedule surface has a12px radius and1px dark border. The white outer frame remains continuous, including when either panel is collapsed. The amber separator ends8px inside the host top/bottom, matching the inner schedule bounds instead of crossing the outer border. Existing width changes and schedule state logic are untouched.

Verified in the enabled browser: computed top, bottom and right insets are8px plus the rendered outer border; schedule radius12px. Tested narrowing with arrow keys and confirmed the schedule remained inside the host. Reopened from the catalog endpoint and double-clicked the visible grip to restore41/59. Captured .impeccable/review/course-explorer/inset-schedule-window.png and retained preview. CSS-only change; no new behavior tests were added.

### 2026-10-27 — Charcoal window and contained edge separator

Applied the supplied charcoal reference to the desktop workspace: catalog/host #1d1f20, inset schedule #262829, and readable light course text with the existing Inter face. Catalog heading uses22px medium Inter; section disclosures, selected states, search, filters and warnings receive dark-surface colors. The page hero/navigation retain their existing treatment.

The separator line is positioned on the inset schedule left border and stops12px before each rounded corner; its interactive hit area remains wider than the1px visible stroke. At the catalog-only endpoint, an overlapping CSS specificity rule left the grip at the wrong offset and the line sat on the outer border. The endpoint now uses a sufficiently specific selector to inset both grip and line8px from the right edge, keeping them clear of the host curve.

Source review checked the final selector precedence, line top/bottom bounds, and endpoint grip transform. Attempted live endpoint verification, but local browser use now reports disabled in Work settings. The final charcoal styling and endpoint correction therefore remain visually unverified; no screenshot from the previous white-host revision represents these changes. CSS-only changes; scheduling logic and persistence remain unchanged.

### 2026-10-27 — Clip schedule scrollbar to rounded frame

Added cx-week-frame around the desktop schedule, separating the12px rounded border from the inner scroll container. The frame clips content; the inner schedule inherits the radius and uses an11px rounded clip path so the native scrollbar and header backgrounds cannot square off the corners. The8px inset and outer host border remain. This fixes the reported square scrollbar edge rather than merely changing the border radius declaration. Source inspection checked that the frame keeps100% height and the existing schedule section remains the scroll owner. Browser verification was attempted but local browser use reports disabled in Work settings; final visual acceptance remains pending.

### 2026-10-27 — Compact reference styling and immediate interaction

Followed the supplied charcoal menu reference more closely inside the scheduling window: both panel headings15px/600 Inter, course text13px, compact20px horizontal spacing, flat charcoal surfaces and quieter inner border. Removed dotted decorative calendar texture, empty-state calendar medallion and extra footer icon; the actual time/day grid remains. Empty-state heading is15px and its browse action is a plain text action. Existing hero and shared site navigation remain the product shell.

Removed the pointer reveal fade in ExplorerPanels and meeting-entry CSS animation/transitions inside the desktop window, keeping frequent scheduling actions immediate. This addresses perceived visual delay; no claim is made about backend latency or measured performance. Resize updates retain their existing direct behavior.

Browser visual verification was attempted but reports local browser use disabled in Work settings. TypeScript result follows. No backend, schedule persistence or course selection logic changed.
Final TypeScript check: PASS. Rendered visual matching remains pending browser access.

### Expanded catalog palette consistency
- Matched expanded course surfaces to the schedule inset charcoal (#252728), with neutral white/gray section text, seats, links, and buttons; removed inherited green primary button fill.
- Retained distinct selected and overlap warning colors, existing actions and persistence.
- Verification: inspected selector precedence for default, hover, selected, and warning states. Visual verification pending browser availability.

### Shared Course / Schedule inspector redesign
- Both requested pages now use the same CourseDetail presentation: paper surface, Inter Tight display typography from Hero, DM Sans controls, course facts in the header, consolidated planning controls, and flat section rows.
- Preserved original catalog description, completion, semester/status selection, prerequisite records, term selection, section add/remove, professor links, and official links.
- Reused existing WAAPI pointer entrance (250ms) and exit (200ms), transform/opacity with existing ease-out token. Keyboard opening is instant; reduced motion fades without translation. Removed competing CSS entry transition on the shared inspector.
- Typecheck run; visual verification pending local browser availability. No backend or persistence changes.
- Follow-up verification: TypeScript passed. Opened CMPE 30 details on both /courses and /roadmap in the browser; confirmed matching panel, title, summary, planning controls and footer. Fixed a late stylesheet override on the overview heading. No persistence mutations performed during visual review.

### Readable typography correction
- Raised Schedule content labels from 9–12px to a 14px floor, search/course names to 16px, workspace headings to 24px, supporting Hero copy to 17px. Hero headline size unchanged.
- Shared Course/Schedule inspector uses 14px minimum metadata and 16px description. Kept existing type families and stronger weights for scanning.
- Filters retain horizontal overflow when the catalog is narrow rather than shrinking text.

### Desktop typography across product routes
- Expanded the readable type floor to Overview, Course, Planner, prerequisite Roadmap, Recommendations and shared product navigation/context. Tiny 9-13px labels now use 14px minimum, with 16px reading text and 17px page introductions where appropriate.
- Kept Home visual styling outside the new product typography stylesheet. In the shared CSS, only route-specific selectors were changed.
- Existing interactions and data flows unchanged; typecheck performed, browser visual validation pending.
- Production build passed. Visual browser check could not run because local browser use is disabled in Work settings; CSS changes need visual review at desktop widths.

### Overview metrics and Roadmap map typography follow-up
- Kept the shared desktop reading scale, while giving the Overview progress and current-term rings explicit line heights, nonwrapping labels, and enough diameter for their text. Raised the current-term supporting figures to 14px.
- Widened the prerequisite map's desktop sidebar and year rows. Years now use a larger, stronger label and the status stays on one line within the row.
- Shortened the green top accent on SVG course cards so it ends at the straight section of each rounded top edge. The same node component serves the map in both contexts.
- `npm run typecheck` and `npm run build` pass. The in-app browser tab is present, but its control interface reports unavailable during this turn; these visual corrections remain unverified in a rendered browser.

### Roadmap sidebar and node follow-up
- Reduced the Year status text to 12px beneath 15px Year labels, and corrected the desktop selector so the actual Roadmap map sidebar uses a 228px column; the prior selector only matched the hero variant, which this page does not render.
- Removed the top accent strip only on the Roadmap map cards. A continuous thin status-colored outline and existing text/dot now carry card state without a bar running into the rounded corners. Landing card styling stays unchanged.
- TypeScript check passes. The browser control interface still reports unavailable, so the live visual result was not observed this turn. Impeccable's typography detector returned advisory off-ramp notices for existing and new sizes; the 12px status size is a deliberate dense-map exception requested by the user.

### Roadmap year hierarchy correction
- The full map had a more specific 180px sidebar rule that overrode the previous 228px correction. Matched that rule directly in the final desktop stylesheet, and tightened the row to 58px.
- Per the user's marked screenshot, Year labels are now 14px (one step down) and the supporting course count/status is 10px (two steps down). The text column remains nonwrapping within the wider sidebar.
- Scoped this to the prerequisite Roadmap; the landing map is unchanged. Visual browser inspection remains pending because browser control is unavailable during this turn.

### Roadmap sidebar width correction
- Reduced the full-map desktop sidebar from 228px to 204px after the user reviewed its width. Reduced sidebar and row side padding so the 10px status labels retain space without clipping.
- This changes only the Roadmap map's desktop layout. Browser control remained unavailable during this follow-up, so the screenshot result has not been independently verified.

### Computer Engineering first-year map
- The prerequisite Roadmap now renders the first two semesters directly from `requirementGroups` and `computerEngineeringCourses`: five Fall requirements (16 units) and four Spring courses (15 units). The GE Area 1C choice remains a requirement, rather than an invented course.
- Cards show course names, units, roadmap status, and recorded prerequisite links. Search, map/list switch, selection, keyboard access, zoom, and the detail strip still work. The landing page keeps its existing illustrative map.
- Scoped desktop styling gives the nine-course diagram two readable rows and distinct treatment for the GE choice. Removed the demo share control from this roadmap view because it does not save a personal plan.
- Updated the page heading and map labels to describe the first-year scope, with a link to the existing eight-semester Course route.
- `npm run build` passed; `node --test tests/prerequisites.test.mjs` passed (3 tests). Browser visual verification was unavailable because local browser use is disabled in Work settings.

### Schedule divider alignment
- The Schedule workspace divider line and drag grip now share one position variable. In split view both align with the inset schedule edge; at either fully collapsed endpoint the grip stays inside the rounded host window with the line through its center.
- The line remains inset from the top and bottom curves. No resize behavior or saved split preference changed.
- `npm run build` passed. Browser visual verification remains unavailable while local browser use is disabled in Work settings.

### Eight-semester Roadmap map and outer-edge divider
- Expanded the Roadmap diagram from the first two semesters to all eight `requirementGroups` in `src/data.ts`. The map now displays 40 course/choice requirements, all semester labels and unit totals, and recorded prerequisite paths across years 1–4. The landing's illustrative graph remains separate.
- The full diagram uses a tall page layout with a small horizontal scroll only when the desktop content rail is narrower than the card layout. Search, selection, map/list view, zoom and official-course detail links remain wired to the same component.
- Corrected the Schedule divider endpoint to sit on the outer border, with its grip straddling that border; the rounded content panels retain their clipping.
- `npm run typecheck`, `node --test tests/prerequisites.test.mjs` (3 tests), and `npm run build` pass. Live visual inspection could not run because Local browser use is disabled in Work settings.

### Restore the progress summary
- Restored the previous Planning overview / Degree progress card with its 64% bar and 11-of-17 figure, using the requested completed wording on the full Roadmap. These are the existing illustrative overview figures, not calculated student completion data. The eight-semester diagram stays in place.
- This is a local JSX/copy restoration using the existing card styles; no data or interaction changes.

### Semester label overflow correction
- Split requirement count and credits into two lines in the full Roadmap's semester labels, retaining the existing type size. Lowered the short rule so the labels stay inside the 115px text column without crossing the vertical divider. Landing labels retain their existing layout.
- Reviewed the SVG positions: both text lines and the rule remain within the semester label column. Live browser inspection is unavailable while Local browser use is disabled.

### React Flow roadmap interaction
- The full eight-semester map now uses the existing `@xyflow/react` dependency, following the upstream xyflow custom-node/NodeToolbar patterns. The SVG landing preview stays separate. Added a project-authored `.agents/skills/react-flow/SKILL.md`; upstream xyflow has no installable SKILL.md. No GitHub publication was performed.
- Course cards and semester labels can be dragged. Controlled node state preserves dragged positions when focus changes. Selection opens anchored course details, raises the selected card and highlights upstream/downstream/corequisite paths via the existing graph traversal helper. Unrelated cards/edges dim; blank-pane click, Escape and the popup close action clear focus.
- Edges are solid straight segments; corequisites retain a distinct color and selected text label. Pan/pinch/zoom remain available, while graph records cannot be edited through connection/deletion gestures.
- After user feedback, restored the old mint/white, thin-border, 8px-corner box styling and its compact internal hierarchy. Explicit card dimensions and scoped paragraph rules prevent the shared page reading scale from making adjacent semester cards overlap.
- TypeScript, production build and the three graph traversal tests passed during implementation. Browser interaction/visual acceptance remains unverified because Local browser use is disabled in Work settings; the user's overlap report was addressed by inspecting the CSS cascade and card geometry.

## Prerequisite map card refinement
- Narrowed React Flow cards to 164px, added reference-style top accents and rounded corners, reused landing mint background washes.
- Increased solid connector weights; removed control cluster and attribution via React Flow options.
- Motion: frequent focus feedback uses only 160ms opacity; removed card translation to keep handles aligned. Reduced-motion variant is 100ms.
- TypeScript compilation passed and desktop browser rendering checked. Vite production bundling was still running at handoff. Mobile and touch interactions not checked.
- Existing graph/data and card composition reused after reviewing upstream shadcn Card; no new dependencies.



## Remove roadmap popups
- Removed NodeToolbar course detail popups from every RoadmapFlow node and deleted unused popup styles/imports.
- Course selection and path highlighting remain; Escape and blank-canvas click still clear focus.
- Validation: source inspection; TypeScript check run. No browser interaction check for this removal.


## Hover path emphasis
- Default edges now use faint curved Bezier paths with arrowheads. Hovering a course emphasizes its upstream/downstream path and dims unrelated courses and edges; mouse leave restores pinned/search focus or the neutral map.
- Click still pins selection; Escape and blank canvas clear it. No detail popups.
- Frequent state feedback uses 160ms opacity transitions with 100ms reduced-motion treatment; node positions remain stable.
- Validation: prerequisite graph tests and TypeScript check; browser hover behavior not directly exercised.


## Corequisite connector treatment
- Corequisites use side handles with dashed amber smooth-step connectors and no visible label. Same-row courses connect horizontally; moved nodes retain side routing.
- Prerequisites retain top/bottom curved connections. Hover emphasis remains shared.
- Validation: TypeScript check; visual browser verification not performed for this change.


## Trim prerequisite canvas whitespace
- Replaced the fixed 1500px canvas and centered fitView with a width-based initial viewport aligned 56px below the top.
- Canvas height follows the eight-semester graph extent at that scale, with 24px bottom breathing room; ResizeObserver recalculates on container resize.
- Hover/click do not reset the camera; pan and zoom remain available.
- Validation: npm run typecheck passed. Browser inspection was blocked because the browser connection reported unavailable; top/bottom spacing still needs visual confirmation.


## Landing background wash on prerequisites
- Inspected the landing map background and its SVG map-fade: the extra shade is a diagonal #e4f2eb wash at 60% opacity fading to transparent over the radial mint base.
- Applied that same palette and fade to the prerequisite graph and Course list with a shared scoped CSS variable; retained the list grid and transparent row surfaces.
- Validation: inspected CSS selectors and layer counts. Browser rendering not verified because the browser connection was unavailable in the preceding check.

## Align course accent with top edge
- Moved the course card accent to the top border and extended it across the card width, replacing the inset stripe.
- Validation: inspected the scoped CSS change; no browser visual check.


## Correct accent corners
- Replaced the rectangular accent strip with a rounded top border that inherits the card radius, eliminating the protruding ends while keeping connection handles visible.
- Validation: CSS source inspection; rendered result not checked.


## Remove prerequisite page topline
- Removed the Back to overview / full-view label row and its unused ArrowLeft import.
- Reduced heading top padding to 6px so the removed row leaves no empty band.
- Validation: source inspection; no browser check.


## Explorer surface contrast
- Increased separation between the charcoal host (#191b1c), catalog (#1d1f20), and inset weekly schedule (#2b2e30), using a clearer #4a4f52 schedule frame.
- Strengthened calendar grid and catalog row separators and brightened secondary text to make the two working areas easier to distinguish.
- Preserved layout, resize behavior, data, and meeting colors. Validation: CSS source inspection only; browser rendering not checked.

## Correct window palette and type hierarchy
- Replaced the inset schedule's charcoal palette with warm ivory #f3f2ec, dark green ink #242924, muted green-gray #5e675f, and pastel meeting surfaces. The host and catalog remain a unified charcoal window.
- Updated calendar, agenda, preview, warning, empty, saved-section, button and focus colors together. Reduced desktop pane headings to 21px and secondary course names to 15px regular weight.
- Verification: inspected the rendered desktop window in the local browser. Calculated contrast: ivory primary text 13.21:1; secondary text 5.23:1; catalog secondary text 9.39:1; mint/blue meeting text 7.71:1 and 7.96:1.
- Limitations: newly opened preview has no saved sections; populated schedule and mobile were not visually exercised in this pass.

## 2026-10-27 — Desktop Course Explorer nested schedule

Changes: `src/explorer-schedule.css` now gives the existing desktop resizable group one evergreen outer shell. The catalog inherits that ground without its own card border. The weekly schedule is inset 20px at the top, bottom and right, with rounded corners, a pale mint surface, subtle border and offset shadow. Catalog text, hover/expanded states and divider use coordinated green tones. Typography and existing component/state logic remain intact. Per the user's clarification, all new appearance is scoped to the desktop workbench; mobile CSS changes were removed.

Trade-offs: Reused the existing panel/frame DOM rather than adding a wrapper or new primitive. Insets consume some calendar width but leave panel constraints, saved ratios, collapse/focus, drag, keyboard and reset logic untouched. The Attio reference image was not attached in the received message; structural direction follows the user's detailed description and the current landing palette.

Actual verification: Production build including TypeScript passed; all 6 existing scheduling tests passed. At 1440px, directly dragged the divider (35.408 to 42.697 percent), exercised an arrow key and double-click reset (41 percent), toggled focus and restored the catalog, expanded CMPE 30 and previewed section 01 in the calendar. Reviewed the rendered desktop hierarchy, insets, readable text and divider. Saved full-page preview to `tmp/explorer-nested-desktop.jpg`. Removed the trial mobile treatment after desktop-only clarification. Left localhost browser tab open.

Uncertainty: No exhaustive E2E run, real enrollment/backend validation, or physical touch gesture testing. Existing schedule add/remove behavior was not exercised in this pass. Final desktop-only scoping adjustment was CSS-only after the successful build.

## 2026-10-27 — Desktop-only clarification

Changes: Removed the viewport subscription and alternate stacked/mobile render from `ExplorerPanels.tsx`. The same resizable desktop group now renders at every viewport width. Removed Explorer's width-based CSS variants, retained pointer/hover states, and gave the Explorer route a 1200px desktop canvas so narrow windows can scroll instead of switching to a mobile layout. Focus, collapse, reset and saved split logic remain in place.

Trade-off: The route is intentionally desktop-only; narrow windows use horizontal overflow. This supersedes the preceding entry's statement that mobile remains a separate unchanged layout.

Verification: TypeScript passed as part of the production build. Source inspection confirms one panel render path and no Explorer width breakpoints. Browser reinspection could not run because browser control became unavailable; requested the local preview panel through the app tool. Narrow-window behavior has not been visually verified in this pass.

## 2026-10-27 — Calendar hour-label spacing

Changes: Widened the shared calendar header/body time column from 49px to 76px. Hour labels now fill that column with 16px left and 12px right padding and right-aligned tabular text, keeping two-digit hours away from the panel edge. No scheduling or resize logic changed.

Trade-off: Day columns share 27px less width. Both header and body use the same column width to retain alignment.

Verification: Typecheck passed. Browser inspection measured a 76px rail and confirmed 16px/12px padding on 11 AM and 12 PM. Visually checked desktop rendering; screenshot saved as `tmp/explorer-hour-spacing.jpg`.

## 2026-10-27 — Graphite / Porcelain Explorer palette

Changes: Applied taste-design color calibration to the nested desktop Explorer. Graphite #27282f owns the parent/catalog surface; Porcelain #f8f8fa owns the inset calendar; Slate #526b8f is the action/focus accent. Updated catalog secondary text, expanded/hover rows, preview and selected schedule blocks, buttons, divider and scrollbars. Added route-specific palette roles to DESIGN.md. Preserved Inter, existing desktop-only geometry, hour-label spacing and all component logic; the user scope overrides the skill's generic typography/mobile/motion recommendations.

Trade-offs: Palette adoption remains local to Explorer. Global navigation keeps its shared teal identity. Semantic conflict and warning colors remain distinct from the slate decorative accent.

Actual verification: Browser screenshot reviewed for nested hierarchy and legibility. Computed contrast samples: catalog primary 12.90:1, catalog secondary 8.17:1, calendar primary 11.89:1, calendar secondary 4.94:1, selected view button 5.44:1. Full preview saved to tmp/explorer-graphite-porcelain.jpg. No new behavior or data changes; scheduling interactions were not rerun for this CSS-only pass.

## 2026-10-27 — Distinct course colors

Changes: Replaced the three-color course hash with eight muted categorical families in ExplorerWeek. All meetings/components and selected-section chips for the same code use the same stable family. Replaced the monochrome theme override with per-family fill/ink/border variables. Preview keeps its course color with a dashed border; conflicts keep their explicit rust warning treatment. The Graphite / Porcelain shell remains intact.

Trade-offs: Eight categorical colors can repeat across the full catalog. Course code and section labels remain visible; color is an additional identification aid.

Verification: Typecheck passed. The three codes in the user's screenshot map to distinct families (MATH 33LA apricot, CMPE 30 slate, CMPE 131 aqua). Browser preview confirmed CMPE 30 Monday and Wednesday share identical slate colors and dashed preview borders. Screenshot: tmp/explorer-course-colors.jpg. Did not add or remove saved sections in this pass. The preceding Graphite / Porcelain production build passed before this course-color change.


## 2026-10-27 — Kết nối frontend hiện tại với backend

### Thay đổi đã triển khai
- Giữ các route, bố cục, font và CSS hiện tại. Reference entry cũng được bọc bằng CatalogProvider, nên Overview và prerequisite map dùng cùng bootstrap catalog với các workspace hiện hữu.
- Thêm src/api.ts làm nguồn cấu hình duy nhất cho catalog và scheduling assistant. Mặc định gọi /api/v1; Vite dev và preview proxy /api tới NestJS ở localhost:3001. VITE_API_URL dành cho API HTTPS khi triển khai riêng; .env.example và README mô tả cấu hình.
- Full prerequisite map đọc courses, requirement groups, placeholders, prerequisite/corequisite wording và nguồn từ catalog đang chọn; hỗ trợ Computer Engineering và Software Engineering. Dùng cột tính toán để cả nhóm có hơn sáu requirements vẫn có tọa độ hợp lệ. Giữ landing preview minh họa theo thiết kế hiện tại.
- Overview thay các môn/số liệu/sự kiện sinh viên mẫu bằng catalog và trạng thái cá nhân hiện có. Không tự tạo enrollment hay completion. Phần trăm thể hiện các core courses được liệt kê, không phải degree audit đầy đủ; placeholders và lựa chọn môn vẫn xuất hiện trong roadmap.
- Bootstrap trả group.key và requirement.sourceKey làm ID ổn định giữa database và local snapshot, thay cho database-generated IDs.
- Xóa sáu file controller/service/module thuộc api/src/catalog và api/src/courses, cùng đăng ký module và tài liệu endpoint cũ: frontend không gọi các endpoint này và đã có dữ liệu qua bootstrap. Giữ health, bootstrap, agent, Prisma, seed, lịch học, cả hai ngành và lịch sử migrations. Không xóa dữ liệu database.

### Kiến trúc, lựa chọn và trade-offs
Tái sử dụng NestJS + Prisma + PostgreSQL và CatalogContext hiện tại để giữ một luồng dữ liệu catalog chung, không thêm backend hay component library mới. Snapshot tiếp tục là fallback có trạng thái và nút retry; assistant vẫn yêu cầu backend/database. Không nối frontend vào các raw Prisma endpoint đã dư thừa. Không thay đổi PRODUCT.md hay DESIGN.md.

Giữ hợp đồng personal draft hiện tại: plans/completion nằm trong React memory; document navigation hoặc refresh khởi tạo lại. Không thêm authentication hay server-side student persistence. Overview có thể bắt đầu ở trạng thái trống; điều này phản ánh dữ liệu hiện có thay vì hiển thị hồ sơ mẫu như dữ liệu thật. Khi frontend triển khai tĩnh, phải cấu hình VITE_API_URL và WEB_ORIGIN cho backend được host riêng; Vercel SPA rewrite không chạy NestJS/PostgreSQL.

### Kiểm tra thực tế
- Production build frontend (TypeScript + Vite) và NestJS build đều thành công.
- Backend typecheck thành công; 22 backend tests và 9 frontend tests đạt. Tests mới kiểm tra bootstrap keys, hai ngành, unsupported program, prerequisites/corequisites, placeholders, closed sections/instructors; kiểm tra Overview không tạo tiến độ, không đếm lặp course và không lấy course ngoài ngành.
- Browser kiểm tra Overview với cả hai ngành, trạng thái draft trống và snapshot. Prerequisite map hiển thị đủ tám semesters; đổi sang Software Engineering, tìm CS 46B, đọc điều kiện CS 46A và chuyển sang filtered course list. Kiểm tra Retry connection đi qua trạng thái connecting.
- Khởi chạy NestJS thực tế trên port 3001; log xác nhận chỉ đăng ký health/bootstrap/agent. HTTP qua Vite proxy: unsupported program trả 404; các endpoint programs và courses đã bỏ trả 404; payload assistant không hợp lệ trả 400. Bootstrap hợp lệ hiện trả 500 do database chưa chạy. Đây là xác minh routing và failure propagation, không phải xác minh truy vấn database thành công.
- git diff --check phát hiện hai dòng trống cuối file đã có ở src/App.tsx và src/Workspace.tsx, ngoài phạm vi thay đổi này; không sửa các thay đổi sẵn có của người dùng.

### Giới hạn và phần chưa xác minh
Docker Desktop không khởi động được: initializing Inference manager gặp lỗi stale/inaccessible dockerInference socket trong AppData/Local/Docker/run. PostgreSQL chưa chạy; NestJS báo database unavailable. Vì vậy chưa xác minh thành công đường đi PostgreSQL → NestJS → browser, và không coi snapshot trong browser là dữ liệu live database. Đã dừng các lệnh Docker bị treo và các tiến trình Docker khởi động thử bị lỗi; không reset Docker hoặc database volume. Không gọi Gemini thực tế và không deploy/commit/push.


## 2026-10-27 — Remove prerequisite map period caption
Changes: Removed the selected Eight semesters / 2026–27 catalog caption from LandingCourseNetwork. The full-map header no longer renders the now-empty action container. Landing preview controls retain their existing rendering.
Trade-offs: Reused the existing fullPlan condition; no styles or data flows changed.
Verification: Typecheck passed. Source inspection confirms the caption is absent and the empty action container is omitted. Browser verification was unavailable because browser control returned browser.user is unavailable; no rendered-result claim is made.


## 2026-10-27 — Prerequisite card progress labels
Changes: Replaced the generic In roadmap label with Completed, In progress, Prerequisites needed, Ready to plan, or Check requirements. Full-map statuses now derive from CatalogContext completion/plans and the original catalog prerequisites, rather than the graph's filtered edge list. The selected-course inspector uses the same labels. Requirement placeholders retain Requirement choice.
Trade-offs: Explicit completion wins over an old plan; only an in-progress plan means In progress. A planned prerequisite does not count as completed. Corequisites must be completed or planned in the same semester. Recorded text conditions remain Check requirements because the app does not verify grades, placement or consent. Landing illustration statuses and map geometry remain unchanged.
Verification: All 14 frontend tests and 3 prerequisite graph tests passed, including five new status tests. Typecheck passed; the subsequent edit only added a fallback string for an unknown status label. Browser rendering was not verified in this pass.


## 2026-10-27 — Match prerequisite progress to completed courses
Changes: The full-map progress bar now uses the same computed completed-course count and percentage as its caption and accessible progressbar values. Disabled the inherited progress-in animation for the full roadmap: its hardcoded final width of 64 percent overrode the data-driven inline width even when the displayed count was zero. Landing illustration animation remains unchanged.
Data flow: Completed course IDs and the selected program now round-trip through sessionStorage for the current browser tab, so marking a course completed on Course/Roadmap is retained when opening Prerequisites or refreshing. CatalogContext remains the single state source; overviewData filters completion to the selected program's listed core courses and excludes planned/in-progress courses from completion. No completion data is fabricated or imported from a transcript.
Trade-offs: Completion lasts for the tab session, with memory-only fallback if storage is blocked. Semester plans remain in React memory. PRODUCT.md and README document the narrow persistence change authorized by the request to match progress across the existing pages. No backend student record or account storage is added.
Verification: All 18 frontend tests passed, including session restoration producing 2 of 3 / 67 percent, invalid/blocked storage, zero and 100 percent cases, unique course counts and excluding other-program records. Typecheck passed. Source confirms full-plan animation is disabled; live browser verification was unavailable because browser control returned browser.user is unavailable.


## 2026-10-27 — Ponytail architecture and performance refactor

Changes: Profiled the actual Roadmap route (/prerequisites) against a snapshot of the starting dirty checkout. Stabilized graph callbacks, node data and static card/handle content; preserved dragged positions and corequisite handle direction while avoiding unnecessary edge regeneration. The final graph revision derives focus in render instead of synchronizing it through an effect. Memoized Course requirement buttons, catalog index, default provider values, Overview summary, Planner grouping, saved schedule calculations and weekly schedule rendering. Removed the App/DegreeRoadmap import cycle by extracting CourseDetail while preserving exports. Replaced Phosphor barrel imports with supported per-icon exports. Backend now reuses parsed meeting data within each search, precomputes sort metrics, indexes bootstrap lookups, and obtains autonomous locks from the already fetched section snapshot.

Constraints and trade-offs: No dependencies, routes, API response contracts, catalog records, database schema or persistence formats changed. No CSS, animation, keyframe, duration, easing, pan/zoom or visual effect was removed or altered. Reverted an adjacency-index experiment after it added overhead on current catalog sizes. Avoided speculative workers, server caches, debounce, stale section caches, lazy-route fallbacks and graph virtualization. Existing unrelated user changes remain present; no commit, push or deployment.

Measurements: Intermediate graph revision reduced median React render work from 7317.6 to 2680.2 ms per synthetic 40-hover trial and p95 frame interval from 350 to 166.7 ms; 240 to 162 median commits. Final removal of the focus synchronization effect remains unmeasured in browser. Seven-batch CPU medians on the same synthetic scheduling inputs: candidate generation 214.17 to 19.65 ms; conflict checks 2.83 to 0.22 ms; autonomous scheduling 386.11 to 46.82 ms. Complete output equality assertions passed. Supported direct icon imports reduced transformed Vite modules from 6347 to 1872, without meaningful production bundle-size reduction. Full methodology, raw artifact paths and limitations are in docs/PERFORMANCE.md.

Verification: Frontend 22 tests pass; backend 24 tests pass; frontend/backend builds pass before the final focus revision, with a final frontend build recorded separately. Course initial server markup is byte-identical (32916 bytes). Measured graph revision passed real browser search, click, drag, persistent dragged position across changed focus, Escape and list-mode checks, including desktop inspection at 1440x1080. Final focus revision needs browser recheck. Browser became disabled repeatedly in Work settings, including after the user reported enabling it and the tool connection was reset; subsequent Planner, program-switch and schedule checks could not run. API port 3001 had no listener; no live PostgreSQL/Gemini timing or end-to-end claim. The browser's computed transition differed from repository CSS, so animation-fidelity validation is still pending; source animation definitions remain untouched.

Final verification: The final focus-derived-state revision passed npm run build and all 22 frontend tests. Backend final build and all 24 tests also passed. git diff --check for changed source/API/scripts/package files passed (only pre-existing line-ending notices). Stopped the temporary baseline Vite helper; kept the user development server intact. Browser verification remains pending for that final revision.


## 2026-10-27 — Recheck refactor and repair stale local API runtime

Findings: Fresh frontend/backend tests and builds passed (22 / 24 tests). Browser regression checks passed for the final graph focus revision, program switching, Course drawer/Escape, Planner add/status/move/remove/Undo/program isolation, Schedule preview/add/agenda/reload persistence/remove, Recommendations draft navigation and Overview rendering. Temporary test data was removed. Final graph benchmark remains above a smooth frame budget: median frame p95 about 200 ms in dev; final raw data is browser-after-final.json.

Fix: Found HTTP 500 on both live bootstrap endpoints. The running Docker image used an obsolete BootstrapController and Prisma client requesting Term.label; current source and database use Term.name. Rebuilt course-radar-api:local and recreated only the api service without migrations, seed or database reset. Container is healthy; both programs return HTTP 200 and the browser confirms Database catalog. Five-request bootstrap medians: CMPE 111.4 ms, SE 85.3 ms. Temporary port-3002 API was stopped, and the old viewport override was reset.

Remaining: npm audit --omit=dev reports 6 production dependency advisories (1 critical, 3 high, 2 moderate); no forced dependency upgrades were made during verification. Browser automation reports an altered computed transition duration, so full animation fidelity and production/native-pointer performance remain unverified. No Gemini request, commit, push or remote deployment. Full evidence and limitations are appended to docs/PERFORMANCE.md.
