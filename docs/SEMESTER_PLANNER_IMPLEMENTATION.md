# Semester Planner implementation



Living report · 2026-10-27 · Desktop scope · `/planner`



## Outcome and changes



The Semester Planner extends the established Course Radar landing visual world into a working planning surface. It uses Inter, a white canvas, near-black type, muted supporting text, teal state accents, and thin divider rules. Large introductory type leads into a limestone workload chart, a flexible number of numbered planning slots, and a full-width course library. The course library combines planned courses and unplanned catalog courses in three filters. This is an extension of the existing visual identity, not a new design system.



The actual landing and the user's direction govern this implementation. `DESIGN.md` and `.impeccable/design.json` remain unchanged; their stale frontmatter was not silently rewritten. `PRODUCT.md` remains the product contract. Inspiration from the supplied ZIP informed composition only; invented CS examples were not imported into the catalog.



- The workload chart derives unit totals from the current plan and lets students select a semester. Stacked segments represent courses; indigo marks the selected semester and graphite marks other semesters.

- Semester tabs expose course and unit counts and select the active slot.

- The course library searches real catalog codes and titles and provides planned, recommended-semester, and all-unplanned filters. Added and completed courses leave the available-to-plan views.

- Each planned course opens the established detail drawer for status changes and semester moves; a separate remove control provides Undo. Native HTML drag/drop moves planned courses onto semester tabs, while the drawer's labeled semester selector supplies a non-drag alternative. Moving a course preserves its status.

- Add, move, remove, and recommended-roadmap operations show feedback with single-operation Undo. The bulk action adds only unplanned catalog courses to valid recommended numbered slots.

- The detail drawer retains requirement information and official course sources. The footer shows the official SJSU program link and catalog connection/snapshot status. The existing detail flow explains the in-session draft behavior.



## Architecture and data flow



`src/workspace-entry.tsx` mounts `/planner` directly inside the existing `CatalogProvider`, `ScheduleProvider`, and `AgentSessionProvider`. `src/SemesterPlanner.tsx` owns the surface; `src/semester-planner.css` scopes its styles with `sp-` classes. No new component-library dependency or independent store is introduced.



`useCatalog()` supplies the selected program, catalog, course lookup, completion set, per-program plans, per-program semester counts, timeline mutations, plan mutations, connection mode, and retry action. The planner derives visible courses, totals, chart segments, and available courses from that shared state. Local React state holds the active semester, search/filter, selected detail, drag marker, feedback, and Undo closure. Program changes reset local selection and feedback; shared plans remain isolated by program.



The existing `CourseDetail` from `src/App.tsx` supplies the detail drawer and its established course information. Links to Courses, Roadmap, and Schedule assistant stay within the workspace entry. Home, Overview, and Prerequisites use full-document navigation to the other entry, preserving the existing dual-entry architecture.



Planning remains personal in-session state. Refresh and cross-entry navigation to Home, Overview, or Prerequisites reset that draft. Numbered slots are not confirmed calendar offerings. Completed courses are excluded from the active plan display. Prerequisite review compares recorded prerequisite IDs against completed courses; an earlier planned slot does not satisfy a prerequisite. Corequisite flags also contribute to the review list. This is not a full official audit of grades, alternatives, electives, availability, or all degree requirements.



## Visual and interaction decisions



The desktop layout places the limestone workload chart above semester navigation and a full-width course library. Planned courses appear in the library's first filter instead of a separate semester table. Thin rules organize dense data; graphite and indigo distinguish planned and in-progress chart segments. The main content has a 1344px maximum width. Desktop inspection covers 1242px and 1440px widths.



Native buttons, selects, and search input preserve familiar interaction behavior. The page includes a skip link, visible focus styles, labeled add/remove actions, pressed states for semester/filter controls, and a status announcement for feedback. These implementation affordances do not constitute a complete accessibility audit.



Motion is restrained: pointer feedback uses 150ms transform transitions gated to fine pointers with hover. Reduced-motion styles remove press transforms. There is no page-entry choreography.



## Alternatives and trade-offs



- Browser feedback led to removal of the separate semester course table. The course library's planned tab keeps editing available while the chart and semester navigation retain cross-semester comparison.

- Native controls and HTML drag/drop avoid adding a drag library or custom select primitive. The move selector remains the dependable alternative; the native drag/drop event path was exercised; physical pointer feel remains unverified.

- The recommended roadmap seeds only real, unplanned catalog courses. It does not create placeholder requirements or imply complete degree coverage.

- Reusing the catalog context preserves existing data flows and program isolation. Persistence and cross-entry state transfer would require a separate architectural change and are outside this redesign.

- Scoped plain CSS follows the workspace styling boundary and the reference landing's visual language without importing its stylesheet globally or replacing the project's theme.



## Verification evidence



Reported session evidence below distinguishes automated behavior checks from visual captures and remaining acceptance work.



| Check | Actual result |

| --- | --- |

| Final `npm run build` | Passed after all six browser-comment changes and CSS cleanup (TypeScript and Vite production build). |

| `npm test` | Passed, 6/6 tests. |

| Headless Microsoft Edge interaction checks | Current design passed: add; course detail status change and semester move; remove and Undo; planned/recommended filters; search empty result; program isolation; all six browser-comment targets removed or restyled. Prior version also exercised chart switching, roadmap fill, detail Escape dismissal, and prerequisite disclosure. |

| Drag/drop and focus | In the current design, native `DataTransfer` dragstart/drop moved CMPE 30 from the planned tab in Semester 1 to Semester 2. Prior detail test confirmed Escape dismissal and focus return. |

| Browser runtime | No page errors observed during those checks. |

| Desktop width | No horizontal page overflow observed at the commented 1242px viewport. |

| Design review | Prior desktop version received a ship disposition after chart-status and heading-kicker fixes. The later browser-comment revision was visually inspected at 1242px and interaction-checked separately. |



Current desktop captures are saved in `.impeccable/review/`:



- `planner-revision-empty.png` — latest empty state at 1242px.

- `planner-revision-populated.png` — latest populated state at 1242px.



Earlier captures from before the six browser comments remain for comparison:



- `desktop-empty.png` — empty planning state.

- `desktop.png` — 1440px desktop composition.

- `desktop-1280.png` — narrower desktop composition.

- `desktop-review.png` — review-state capture.

- `desktop-details.png` — reused course detail drawer.



## Remaining uncertainty and boundaries



Native HTML drag/drop was verified through dispatched native drag events; a physical pointer gesture was not independently feel-tested. Headless interaction coverage does not prove every pointer interaction, browser implementation, keyboard path, or assistive-technology experience. Reduced-motion behavior has not received independent interaction acceptance.



Mobile acceptance was not requested and is not claimed; CSS fallbacks exist but are outside verified scope. Connection/snapshot status communicates catalog provenance without implying live section availability. No backend persistence, enrollment guarantee, official degree audit, commit, push, or PR is part of this work.



Update this report when additional acceptance checks complete; retain the distinction between implemented behavior and observed evidence.



## Landing navigation connection — 2026-10-27



Added Semester planner links to the active landing header navigation and footer. Both Start planning CTAs now open /planner. The hero course-map action still opens the prerequisite explorer. Normal anchor navigation retains the existing separate-entry stylesheet architecture. Verified in desktop Edge that the header CTA opens the actual planner and that header, footer, and closing links target /planner. No visual styling changed.





## User palette reference — 2026-10-27



Replaced the chart’s dark green palette with colors sampled from the supplied swatch: lavender ground #f4f5ff and periwinkle accent #7487e5. Dark indigo ink, pale blue planned segments, and deeper blue in-progress segments keep chart status readable. Semester selection and course-filter selection use the same accent family. Captured and visually inspected the populated desktop at 1242px; no horizontal overflow or page errors observed. This CSS-only change preserves layout and planning behavior.



## Flexible planning duration — 2026-10-27



The catalog's recommended eight semesters are the initial timeline rather than a fixed planning limit. Add semester extends the selected program's plan one slot at a time and selects the new slot. There is no product-imposed maximum duration. The last added semester can be removed only while empty; occupied slots cannot be deleted. Semester counts are stored per program in the existing session context, so empty added slots survive course removal and workspace route changes. Refresh retains the app's existing reset behavior.



The chart's columns and year groups derive from the current count, including an incomplete final year when the count is odd. Long charts and semester navigation scroll horizontally with readable minimum column widths, and selecting or adding a semester brings it into view. Years remain groups of two numbered planning slots, not claims about actual term offerings or a graduation date.



CourseDetail uses the same dynamic semester count everywhere it is opened, including Course Explorer and Degree Roadmap. Moving a course through its semester dropdown now explicitly preserves its current planned/in-progress status. Restoring a removed course through Undo also restores its slot if that empty slot was removed in the meantime.



Verification: TypeScript/Vite production build passed. Desktop Edge checks extended a plan to 12 and then 20 semesters, verified six and ten year groups, moved a course to Semester 12 and 20, preserved in-progress status, blocked deletion of occupied final slots, removed an empty final slot, restored the slot through course Undo, and verified program-specific lengths and courses after switching programs. No runtime errors or horizontal page overflow were observed at 1242px. Captures planner-six-years.png and planner-ten-years.png in .impeccable/review/ were visually inspected. Physical trackpad/mouse scrolling feel and mobile behavior are outside this verification.


## Desktop gutters, chart contrast, and semester spacing - 2026-10-27

Applied the latest browser feedback: desktop header and content use 32px gutters at 1242px instead of 48px. The chart uses landing limestone #f4f4f2, dark neutral text, graphite planned segments #6f7680, and indigo in-progress segments #3f54a6. This supersedes the earlier lavender palette.

Removed the first semester's zero-left-padding exception. Every desktop semester button now uses 12px top, 14px horizontal, and 16px bottom padding, with equal column widths. Long plans retain contained horizontal scrolling.

Verified in desktop Edge at 1242x668 with ten semesters: all ten buttons have identical computed padding and 130px widths; left/right gutters measure 32px; chart background and bar colors match the new palette; selecting Semester 10 updates the library filter; no page overflow or runtime errors. Captured and inspected .impeccable/review/planner-spacing-desktop.png. This pass changes CSS only; planning logic remains covered by the earlier functional checks.

## Selected semester column - 2026-10-27

Following explicit user clarification, the entire selected semester column now uses indigo. Other semester columns use graphite, independent of course status. The legend now reads Other semesters / Selected semester so color describes selection accurately. Course status remains available in course details and segment titles. Verified computed colors for every segment at 1242px, switching selection restores the previous column to graphite, and visually inspected planner-selected-column.png.

## Navigation coverage and search focus - 2026-10-27

Added Semester planner to Overview and Prerequisites header navigation and Overview footer. Landing and workspace routes already expose it. Desktop Edge click-through verified the real /planner page from /, /overview, /prerequisites, /courses, /roadmap, and /recommendations.

Search focus replaces the green outer ring and duplicate input outline with a graphite border and inset bottom rule. Purpose: state indication and feedback. CSS animates only the rule's transform and opacity for 150ms using the existing strong ease-out token. Keyboard focus applies immediately; reduced motion removes transform. No text or layout movement. Verified pointer focus, keyboard return, working search filtering, absence of green/duplicate outlines, and the reduced-motion computed transform. Visually inspected planner-search-focus.png at 1242x668. Animation feel beyond the captured state has not received independent review.
