# Course Radar — Figma redesign

Date: 2026-10-25

Design: https://www.figma.com/design/W13rGgazGRDjliJREleeGn?node-id=2-301

## Deliverable

An editable visual design concept based on the current React application. Seven desktop screens (1440 px): Overview, Course explorer, Degree roadmap, Prerequisites, Semester planner, Recommendations, and Course details. Three mobile screens (390 px): Overview, Course explorer, and Course details.

The Figma file is a visual design deliverable rather than a wired interactive prototype. Long catalog/roadmap/planner views show representative content rather than every record. The follow-up implementation below applies its visual direction to the existing application.

## Design decisions

- Academic studio direction: warm neutral canvas, deep green navigation, restrained lime highlights, generous spacing and rounded content panels.
- Retain the existing Atkinson Hyperlegible and Crimson Pro font families.
- Persistent desktop navigation; compact mobile header; stacked course and section cards on mobile.
- Keep completion counts scoped to named catalog courses, session-only planning, and historical seat availability explicit.
- Use existing Simple Design System button instances, adapted to the product palette and typography, plus eleven scoped local semantic color variables and five text styles.

## Source grounding

Inspected src/Workspace.tsx, src/App.tsx, src/Recommendations.tsx, src/data.ts, src/fall2026Offerings.generated.ts, src/main.tsx, and current CSS. Viewed the live local Overview at http://127.0.0.1:5173/. Initial state has 0 of 31 named Computer Engineering courses completed. BIOL 10 section examples use the repository snapshot dated September 10, 2026; they are not live seat counts.

## Verification

- Reviewed desktop compositions and all three mobile designs via Figma screenshots.
- Corrected prerequisite-path horizontal overflow and wrapped mobile text heights after visual inspection.
- Structural audit before the final text-height repair: 647 editable descendants, including 377 text layers, 205 frames, 38 rectangles and 27 component instances; no image-filled UI layers.
- Font audit: Atkinson Hyperlegible and Crimson Pro only in review content.
- Final horizontal bounds check and post-fix visual checks completed; no horizontal overflow detected.
- No application tests were run because no executable application source was changed.

## Handoff

Review board: 2:257. Desktop: Overview 2:301; Course explorer 2:399; Degree roadmap 2:503; Prerequisites 2:592; Semester planner 2:676; Recommendations 2:760; Course details 2:839. Mobile group: 2:930; Overview 2:931; Explorer 2:966; Details 2:1005.

Figma screens do not demonstrate runtime behavior. See the implementation status below for the application work.

## Follow-up: desktop browser implementation

The user confirmed desktop browser as the target; further mobile design and mobile verification are out of scope.

- Added src/studio.css with the academic studio palette, fixed desktop sidebar, editorial overview, cards, course list, roadmap, prerequisites, planning grid, section drawer, calendar, and scheduling assistant styles.
- Updated src/Workspace.tsx to apply the new styles, show desktop navigation icons and contextual sidebar copy, and add linked Explore / Connect / Plan actions. Existing catalog, plan and scheduling providers continue to supply the real content.
- Kept basic narrow-window fallback behavior so a resized browser remains navigable; no separate mobile product is being built.
- Architecture trade-off: a dedicated visual stylesheet loads after the existing workspace stylesheet, preserving its functional graph/calendar geometry. This is reversible and avoids changing data logic, but retains legacy cascade complexity. It should be consolidated after visual acceptance.
- Local Vite preview responds at http://127.0.0.1:5173/ with HTTP 200.
- npm run build passed; npm test passed all six existing scheduling tests. These tests cover meeting parsing and conflicts, not visual layout or browser interactions.
- Browser automation returned "Local browser use is disabled in Work settings". The new application UI has not been visually verified in a browser, and keyboard/interaction smoke checks remain outstanding. Earlier Figma screenshots verify the design concept only.

## Desktop web revision — 2026-10-25

The green Figma-derived direction above was rejected as too generic. The live web app now uses a quieter planning-tool visual system based on the `emil-design-eng` skill in [Emil Kowalski's skills repository](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng): precise interaction feedback, restrained motion, good defaults, and reduced-motion support. The old Figma artifact remains a historical concept; this revision is in the browser implementation, not the Figma file.

- Replaced the dominant dark green sidebar and lime highlight with a light navigation rail and a single indigo action color. Removed promotional sidebar copy and the Explore/Connect/Plan centerpiece.
- Reduced decorative cards and empty-state height. Overview has direct shortcuts and labeled progress; recommendations has a compact schedule empty state and a clearer assistant workspace.
- Rewrote template-like headlines and empty-state copy to describe actual actions and state. Course lists and roadmap rows retain their functional data and interactions.
- Preserved providers, API calls, course statuses, planner logic, section selection, and catalog-source labels. `src/studio.css` remains a late visual layer over the legacy stylesheet; consolidation is future cleanup.
- Visual QA: fresh 1440×1000 Chrome screenshots of Overview, Course explorer, Semester planner, Degree roadmap, and Recommendations were inspected. Local Browser control was still disabled in Work settings, so the screenshots used Chrome headless; interactive pointer/keyboard QA in the shared Browser tab was unavailable.
- `npm test` passed 6 scheduling tests. The final `npm run build` passed after all source edits. No mobile redesign was undertaken.
