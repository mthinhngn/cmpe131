# Course Radar design system

This document describes the active interface. Removed design experiments and screenshots are not implementation dependencies.

## Home

The approved Home is `src/main-landing.html` and `src/main-landing.css`, mounted by `src/landing-entry.ts`. Preserve its split hero, sticky composition, editorial explanation sheet, entrance sequence, and four preview controls. The palette is canvas `#f4f4f2`, paper `#fafaf8`, ink `#111111`, lines `#dadad6`, and muted text `#5f5f5b`. Hanken Grotesk carries body text and controls, Inter carries the hero, and JetBrains Mono carries captions. The content rail is capped at 1280px.

The active animation lives in `public/showcase/`. `LandingMapEmbed` preserves the original hero frame, sizing, shadow, border, and right-edge fade. Preview pages loop Overview, Schedule, Planner, and Roadmap; controls communicate through checked same-origin frame messages. Preview records are illustrative and never write to personal workspaces.

## Workspace

Overview, Schedule, Planner, Roadmap, and Account share a white canvas, charcoal Inter text, thin neutral borders, and compact controls. Use the shared `ProductHeader` and `ProductPageHeading`; do not introduce alternate pages or a second assistant. Shared visual tokens live in `src/product-surfaces.css` and the existing route styles.

- **Overview:** preserve the current bento composition, progress indicators, course details, and term charts driven by saved data.
- **Schedule:** preserve the catalog/search and weekly-calendar arrangement, filter behavior, and expandable calendar.
- **Planner:** preserve semester columns, draggable terms/courses, completed-course placement, and saved Winter/Summer terms.
- **Roadmap:** preserve the semester stepper, mint grid, React Flow cards, prerequisite/corequisite paths, pan/zoom, completion actions, and elective picker.
- **Account:** preserve the centered settings form and shared workspace/profile behavior.

Subject identity, completion/status labels, focus states, and recorded source links remain legible. Use existing plain-CSS primitives under `src/components/ui/` and retain upstream licenses. There is no Tailwind dependency in the current app.

## Motion and interaction

Preserve the current approved animation timing, interruption behavior, and reduced-motion behavior. Cleanup must not disable intended motion. Keep keyboard navigation, Escape/close behavior, focus restoration, visible focus rings, and accessible status/error messages. Save success is shown only after the workspace API accepts the operation.

## Sources

Current specifications: [Home](docs/surfaces/landing-map-b.md), [Overview](docs/surfaces/overview.md), [Schedule](docs/surfaces/schedule.md), [Planner](docs/surfaces/planner.md), and [Roadmap](docs/surfaces/prerequisite-map.md). Product behavior is defined in [PRODUCT.md](PRODUCT.md).
