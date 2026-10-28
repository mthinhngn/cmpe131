# Degree roadmap

Route: `/roadmap`. Mode: Operate. Acceptance scope: desktop only. Updated 2026-10-27.

## Direction contract

THESIS: Extend the current landing identity into a readable, connected degree sequence that students can use to inspect requirements and act on personal progress.

OWN-WORLD: Follow the live `ReferenceLanding` radar mark, Inter typography, white editorial canvas, restrained rules and compact controls. Extend the existing route-specific green vocabulary with an evergreen year band and pale course branches. This local extension does not redefine the global design system.

STORY: Read all four years and eight semesters immediately. Use the year navigation only to jump within the complete sequence. Expand requirement choices or open the course panel to review conditions, plan a semester, record completion and inspect listed sections.

FORM: Split editorial introduction; program/catalog source row; connected four-year navigation; two semester branches with course nodes, units and requirement choices; official-source and session-draft context. Connector lines describe recommended sequence, not prerequisite edges.

SCOPE: Desktop redesign informed by the inspected Manus `degree-roadmap-only.zip` and the current landing. Preserve real catalog, planner, completion and section flows. Keep changes local to the roadmap and its workspace header treatment; no global theme or mobile redesign.

PROOF: This is a code-led preview, with no separately approved comp. Typecheck, build, schedule tests and selected browser interactions have evidence; desktop preview captures and a scoped finish review are recorded below.

## Product invariants

- `CatalogContext` supplies the program, official requirement groups, course records, plans and completed-course state. The shared context bar retains program selection and catalog connection status.
- Semester units come from official group titles. The progress indicator counts named roadmap courses completed; it is not a degree-audit percentage and does not claim requirement choices are fulfilled.
- Search covers course codes, titles, requirement labels and descriptions across all years. Status filters use current personal plan/completion state. Selecting a year clears search and filters and jumps to that year without hiding any other year.
- Named course buttons open the existing `CourseDetail` drawer, retaining course conditions, official sources, completion, semester planning, sections and schedule selection.
- Requirement choices remain distinct native `details` disclosures with catalog descriptions. Course nodes retain textual progress/condition cues; hover/focus can highlight visible recorded prerequisite courses.
- Personal plans and completion remain session drafts that reset on refresh. Official requirements take precedence; section availability remains a dated snapshot.

## Architecture and trade-offs

`src/DegreeRoadmap.tsx` composes the page, local year/search/filter/selection state and derived catalog views. It reuses `CourseDetail` from `src/App.tsx`; it introduces no separate planning model. `src/Workspace.tsx` supplies the existing route class and a roadmap-only radar wordmark. `src/roadmap.css` applies scoped plain CSS after the shared workspace styles. No new dependency, primitive, route or persistence behavior was added.

All four years and eight semesters render together, per the latest user instruction. Year navigation jumps within the document; search and status filters narrow the full sequence. This favors immediate discovery at the cost of a longer page. Connectors show recommended progression rather than prerequisite topology.

The current landing's Inter and radar mark intentionally guide this route. `DESIGN.md` retains older typography metadata alongside subsequent landing updates; detector warnings against that older metadata are recorded below rather than treated as approval to rewrite the global system.

## Verification and remaining uncertainty

- `npm run typecheck` passed. The final production build passed after the header and course-condition fixes.
- Six existing schedule tests passed. No new dependency or persistence mechanism was introduced.
- Browser interactions passed for selecting Year 2, opening a course and marking it completed.
- Initial captures used an 845px side panel; final hero and route captures use a 1227×660 desktop browser viewport. No phone-size acceptance is claimed.
- The detector ran once and reported font, palette and type-ramp warnings against older `DESIGN.md` metadata. Inter follows the live landing intentionally; this is not a clean detector pass.
- The finish reviewer scored the misleading prerequisite label fixed and returned scoped ship. All-year search for CMPE 195 returned CMPE 195A/B from Year 4 while Year 1 was selected. Search/filter combinations, native requirement expansion, program switching and full section/planner flows were not exhaustively exercised. Final desktop screenshots: `.impeccable/review/roadmap-hero.png` and `roadmap-desktop-route.png`.

## User-directed copy cleanup — 2026-10-27
The roadmap hides the shared connection-status banner and removes the lower reviewed-date/session sidebar. The hero names the official SJSU catalog as the direct source, without claiming a fresh remote fetch per page view. Existing API/fallback behavior remains unchanged.

## Course panel and full sequence — 2026-10-27

The roadmap passes `variant="roadmap"` to the existing CourseDetail. Scoped `roadmap-detail.css` gives it a 580px white/Inter/evergreen shell with fixed title, units and catalog source; independently scrolling about, plan, conditions and listed sections; and a fixed source footer. Other routes retain the default variant. No dependencies or persistence changes. Existing focus trap and focus restoration remain; Escape within the term picker stops propagation before dismissal.

Motion is occasional spatial orientation: CSS transform with the existing drawer curve at 250ms; hover changes use color only. Shared reduced-motion rules remain active. All-year jumps are instant.

Verification: production build and six schedule tests passed; final typecheck passed after the picker Escape fix. At 1242x668, browser checks confirmed all four year headings on initial render and after a Year 4 jump, Semester 2 assignment, adding/removing a LAB section, completion clearing its plan, undo, and Escape focus restoration. Screenshots: `.impeccable/review/roadmap-detail-top.png`, `roadmap-detail-middle.png`, `roadmap-detail-sections.png`, `roadmap-all-years.png`. The finish reviewer returned ship for this desktop scope. One detector pass reported only palette/type/radius advisories against older design metadata. Open term picker, corequisites, unavailable-term state and every program/section combination were not fully exercised. Browser control was subsequently disabled in Work settings; final reopening was requested through the app tool but not visually reconfirmed.

## Reference palette adoption — 2026-10-27

The user authorized a shared palette/type expansion from five supplied images. `roadmap-palette.css` applies deep teal, cyan, cloud, mist, slate and peach roles to this page and its drawer. Instrument Serif is used only for editorial titles; Inter remains the operational face. DESIGN.md and .impeccable/design.json hold the reusable guidance. All-year visibility and data actions are unchanged. Current browser control is disabled, so this palette pass has no newly verified rendered screenshots.

Typography correction: user rejected the serif change; all roadmap and drawer typography remains Inter with prior sizes and weights. The new palette remains.

Latest refinement: neutral black/gray hero, inward supporting copy, direct course-topic text, and an inset560px inspection sheet replace the previous flush panel. Inter and all-years visibility remain. Pointer entry/exit200ms; keyboard immediate; rendered motion review unavailable while browser control is disabled.
