# Course Radar performance refactor — 2026-10-27

## Scope and method

Applied [Ponytail's engineering rules](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md): trace existing flows, reuse installed capabilities, make targeted changes, retain validation and accessibility, and measure rather than add speculative infrastructure. No dependencies added; no routes, API contracts, database schema, persistence format, CSS, keyframes, easing or animation durations changed.

The menu's **Roadmap** is `/prerequisites`, using `LandingCourseNetwork` → `RoadmapFlow`. `/roadmap` is the **Course** semester-details page, using `DegreeRoadmap`. Both were inspected. Initial source was captured before edits in `tmp/performance/baseline`; this is a snapshot of the user's dirty checkout, not Git HEAD.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Roadmap | Hover recreated semester nodes, course data, callbacks and every edge. A focus effect caused another state/render cycle; edge arrays also changed on node measurement/drag. | Stable callbacks and static JSX; memoized card content; reuse unchanged nodes and semester data; indexed position lookup; update edge handles only when corequisite direction changes. Final revision derives focus directly from position nodes rather than synchronizing it through an effect. |
| Course page | Hover rerendered every requirement button and repeated filtering. `App` and `DegreeRoadmap` imported each other. | Memoized course buttons and filtering; reuse provider index; moved drawer implementation to `CourseDetail`, retaining `App` exports for compatibility. |
| Shared providers | Course lookup rebuilt on plan changes; empty schedule arrays and welcome sessions invalidated memoized consumers. | Stable catalog index, empty selection and default agent session. Existing storage and cancellation remain intact. |
| Planner | Same planned-course list filtered repeatedly per semester and chart render. | Group planned courses once per plan change. |
| Home / Overview | Degree summary recomputed for local search/menu/selection updates. | Memoize summary against its catalog/progress/plan inputs. |
| Schedule / Recommendations | Unchanged weekly schedule rerendered during composer updates; repeated conflict and untimed calculations in explorer. | Memoize weekly schedule and saved explorer calculations; group offerings with bucket push rather than copying buckets. |
| Module loading | Phosphor barrel expanded a large icon dependency graph. | Use the installed package's supported per-icon exports, preserving identical icons. |
| Bootstrap | Requirements flattened/scanned for each course, and versions scanned again per requirement. | Build request-local maps once; preserve first-match semester behavior and response shape. |
| Scheduling backend | Meeting strings parsed repeatedly for every pair/search branch; ranking comparator recomputed metrics during sorting. Autonomous tool fetched all term sections and then fetched locked sections again. | Parse once per candidate search / conflict batch; precompute ranking keys; reuse the same term snapshot for locks and index sections by course. No cross-request cache or stale-seat cache. |

The attempted adjacency-index traversal was reverted: rebuilding its index was slower for the real small catalog. Current traversal remains the original implementation. No workers, debouncing, reduced graph detail, virtualization, animation suppression or framework rewrite was introduced.

## Measurements

### Browser: development build, observed intermediate revision

One IAB tab, same default viewport for both measurements; React StrictMode and an opt-in React Profiler were active. Three trials of 40 deterministic synthetic mouseover/mouseout pairs, one animation frame after each event, across the same 40 CMPE nodes. Baseline source was served through `scripts/performance/vite.config.ts` at port 5175; current source at port 5173. Reported figures are medians of three trials.

| Metric, per trial | Baseline | Measured optimized revision |
| --- | ---: | ---: |
| React render duration total | 7,317.6 ms | 2,680.2 ms |
| React commits | 240 | 162 |
| React render duration p95 per commit | 84.7 ms | 47.5 ms |
| Frame interval p95 | 350.0 ms | 166.7 ms |
| Frames over 25 ms, of 80 intervals | 80 | 53 |

Render work decreased about 63%, and p95 frame interval about 52%. **This does not establish 60 FPS or production INP.** The machine/browser showed substantial variance and the test used synthetic hover events; it does not measure trusted hardware pointer input, CSS `:hover`, continuous mousemove, pan/zoom, GPU paint time or production performance. React Profiler durations exclude some commit/paint work. The browser environment reported a computed card transition of `opacity 1e-05s`, despite unchanged repository rules specifying 160ms: full-fidelity animation timing could not be verified in that environment.

Raw results: `tmp/performance/browser-before.json`, `browser-after-initial.json`, `browser-after.json`. The **final focus-derived-state revision came after these measurements**; its browser comparison remains pending because the browser tool again reported disabled in Work settings, including after the user enabled it and the connection was reset. Do not attribute the above numbers to that unmeasured revision.

### CPU domain comparison

Node v24.16.0, Windows; median of seven warmed batches, milliseconds per invocation. Scheduling fixture: four courses, 32 sections, same 5,000 branch limit, same requested result count. The script asserts complete output equality against captured source, including order, warnings, metrics, trace and proposal IDs.

| Operation | Before | After | Speedup |
| --- | ---: | ---: | ---: |
| Candidate schedule generation | 214.1704 ms | 19.6507 ms | 10.90× |
| Conflict check, 32 sections | 2.8288 ms | 0.2175 ms | 13.01× |
| Autonomous schedule generation | 386.1060 ms | 46.8172 ms | 8.25× |

These are synthetic CPU results, not PostgreSQL query latency or Gemini response times. Absolute timings vary with host load. No traversal speedup is claimed after reverting that experiment.

### Build and module loading

Replacing Phosphor barrel imports reduced Vite's transformed modules from **6,347 to 1,872** (70.5%). Observed Vite build stage was 67 seconds before and 12–13.5 seconds afterward, with host/cache effects uncontrolled; module count is the reliable structural comparison. Production JavaScript size stayed approximately the same: tree shaking already removed unused icon code. No meaningful production bundle-size reduction is claimed.

## Verification and remaining work

- Frontend tests: 22 pass, covering schedule parsing/conflicts, overview totals, status semantics, session persistence and graph traversal. Prerequisite tests are now included in the standard `npm test` command.
- Backend tests: 24 pass, including new regressions for request-local meeting reuse, updated meeting fields, one section read, and retaining closed/unknown lock warnings.
- Frontend and backend production builds passed, including the final post-measurement graph revision (1,872 transformed modules; final Vite stage 24.74 seconds).
- Before/after `/roadmap` initial server-rendered markup is byte-identical: 32,916 bytes; SHA-256 `a1d52f0aba87d4a06ff1f7b1e9c09df7528f9ef818783fe861ca3e55c8fff10c`. This verifies initial structure, not animation or browser interactions.
- Browser checks on the measured optimized graph revision: search CMPE 126, inspect highlighted related/shaded nodes, click selection, drag CMPE 126, change focus to MATH 42, Escape, retain dragged position, and switch to list. Desktop inspection at 1440 × 1080. These preceded the final focus-derived-state revision.
- Browser was disabled again before program switching, Planner and schedule regression flows could be completed. The temporary desktop viewport could not be reset after the tool was disabled.
- No API listener was present on port 3001 during the check. Browser used the reviewed fixture. Live PostgreSQL request timings, query plans, full browser → API → database behavior, Gemini and production-load profiling were not verified. No data migration or remote deployment was attempted.
- Remaining observed bottleneck: graph development-frame latency is still above a 16.7ms frame budget. Recheck final graph revision in the enabled browser, then use a production build and native pointer trace to distinguish React, style/layout, paint and host contention before any further implementation changes. Do not remove visual effects to meet a benchmark.

## Reproduction

Captured baseline files are required; do not replace them with Git HEAD because HEAD differs from the starting UI.

```powershell
node --import ./api/node_modules/tsx/dist/loader.mjs scripts/performance/domain.mjs
$env:TSX_TSCONFIG_PATH='tsconfig.app.json'
node --import ./api/node_modules/tsx/dist/loader.mjs scripts/performance/markup.mjs
npx vite --config scripts/performance/vite.config.ts --host 127.0.0.1
```

For browser comparison, open `/prerequisites?profile` on baseline/current servers and read `#course-radar-profile`. `/roadmap?profile` targets Course page buttons. The baseline helper server was stopped after measurement. The profiler is development-only and absent from production bundles. It triggers temporary hover presentation, never persists plans, schedules or completion. Navigation without `?profile` runs the normal application.


## Recheck — 2026-10-27

Fresh verification: 22 frontend tests and 24 backend tests passed; both production builds passed (frontend Vite stage 14.83 seconds / 1872 modules). Final graph revision was measured: three-trial median 124 commits, 3977.0 ms React render total, 63.2 ms render p95, 199.9 ms frame p95. Raw data: tmp/performance/browser-after-final.json. Host load differs from the original run; these numbers do not establish a controlled speedup or 60 FPS.

Final graph browser checks passed: CMPE 126 search (6 related / 34 shaded), selection, native drag, retain dragged position after selecting MATH 42, Escape clears focus; program switch produced 42 SE nodes starting CS 46A and returned to 40 CMPE nodes starting CMPE 30. No console errors in the verification tab. Computed transitions still report opacity 1e-05s, so full animation fidelity remains unverified in the browser environment.

Planner browser checks passed: add CMPE 30, set in-progress in drawer, move to semester 2, Escape, remove/Undo, program isolation, return to the original plan and retained in-progress status. Schedule checks passed: preview-only state, two visible weekly meeting blocks, add section, agenda, reload persistence, remove section. Test-created plan entries and sections were removed. Recommendations draft survived confirmed client-side navigation to /courses and back, then was cleared without an API/model call. Course drawer opened and closed with Escape in a clean verification tab. The original tab had an unsaved browser-comment overlay intercepting navigation, so those navigation checks were repeated in a separate tab.

A newly available API returned HTTP 500 for both programs. Diagnosis: running Docker image contained an obsolete BootstrapController and Prisma client referencing Term.label, while the current schema/database use Term.name. Container rebuild from current checkout was started without changing schema or data; runtime verification is recorded below after completion.

Production dependency audit (npm audit --omit=dev) reported 6 dependency advisories: 1 critical, 3 high, 2 moderate. Affected packages: proxy-addr, body-parser, multer, zod, qs and the inherited Nest platform-express advisory. This is a package audit, not evidence that every advisory is exploitable through Course Radar. Exact npm output: tmp/performance/api-audit.json. No forced dependency upgrades were applied during this verification pass.


Runtime repair completed: built course-radar-api:local from the current source and recreated only the api service with docker compose up -d --no-deps api. No migrate/seed/reset was run; PostgreSQL data was retained. The old image/client mismatch is resolved. Port 3001 now returns HTTP 200 for health and both bootstrap programs. Five-request medians: health 11.1 ms, CMPE bootstrap 111.4 ms, SE bootstrap 85.3 ms. CMPE returned 31 courses / 8 groups / 414 offerings; SE returned 30 courses / 8 groups / 414 offerings. These are current response timings, not a controlled before/after benchmark. Raw results: tmp/performance/live-api-recheck.json.

Browser confirmed Database catalog for both programs through the normal Vite proxy, with 40 CMPE graph cards. No console errors in the final verification tab. Overview rendered its actual zero-progress/empty-plan state without errors. The separate temporary API on port 3002 was stopped after checking current code against PostgreSQL. The temporary viewport override from the earlier run was reset. Model-provider execution was not tested; no Gemini request was sent. Dependency advisories and production/native-pointer/animation-fidelity verification remain open; functional checks do not establish that every feature or animation is regression-free.
