# Course Radar project guidance

## UI component source

For UI component work, consult [docs/UI_COMPONENTS.md](docs/UI_COMPONENTS.md). The official shadcn/ui source is available in `.references/shadcn-ui/`; run `npm run ui:sync` if it is missing.

Search that source for useful component behavior, examples, and required dependencies before writing a new primitive. Adopt only the components needed by the task into `src/components/ui/`, and adapt their styling to the project's `DESIGN.md`. Preserve the current catalog, planner, schedule, and assistant data flows.

The reference checkout is upstream source material, not part of the app or its dependency graph. Do not run its monorepo installation or replace the app's theme with its defaults. The active landing and workspace use plain CSS. Inspect existing files before adding or replacing primitives. Preserve upstream license notices when copying source.

## UI orchestration

For frontend/UI, component, chart, layout, styling, animation, responsive, or redesign work, use the project `ui-flow` skill. For substantial UI work, read `PRODUCT.md` and `DESIGN.md` first: `PRODUCT.md` defines product intent and `DESIGN.md` defines visual direction. Preserve both unless the current request explicitly asks to change them. Let `ui-flow` decide when a specialist skill is relevant instead of invoking every design skill automatically.

## Canonical project and UI

The root checkout at `C:/Users/thinh/CMPE131`, served on port 5175, is the single active project. Other Orca worktrees are inactive recovery backups. Preserve the approved desktop Home (`landing-entry.ts` + `main-landing.html`), Overview (`ReferenceOverview`), Schedule (`CourseExplorer` + `ExplorerWeek`), Planner (`SemesterPlanner`), and Roadmap (`PrerequisiteMap`). Keep the active Home animation under `public/showcase/`. Keep `Workspace` as shared navigation only. Do not introduce alternate screen implementations or another assistant surface.

All new backend, AI, and browser tests must integrate with these screens. The sole assistant is `ChatWidget` using the Course Action + Web Search service through `/agent`. Planner actions must save through `PersistentPlanningStore` and the authenticated workspace API before acknowledgement. Accounts, saved plans, completion records, and schedules must continue to share that store. Desktop is the required verification target.
