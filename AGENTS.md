# Course Radar project guidance

## UI component source

For UI component work, consult [docs/UI_COMPONENTS.md](docs/UI_COMPONENTS.md). The official shadcn/ui source is available in `.references/shadcn-ui/`; run `npm run ui:sync` if it is missing.

Search that source for useful component behavior, examples, and required dependencies before writing a new primitive. Adopt only the components needed by the task into `src/components/ui/`, and adapt their styling to the project's `DESIGN.md`. Preserve the current catalog, planner, schedule, and assistant data flows.

The reference checkout is upstream source material, not part of the app or its dependency graph. Do not run its monorepo installation or replace the app's theme with its defaults. The landing uses Tailwind v4 with the `cr:` prefix and opt-in theme variables; workspace pages and existing primitives retain plain CSS. Follow `docs/UI_COMPONENTS.md` for the mixed-style boundary and inspect existing files before adding or replacing primitives. Preserve upstream license notices when copying source.

## UI orchestration

For frontend/UI, component, chart, layout, styling, animation, responsive, or redesign work, use the project `ui-flow` skill. For substantial UI work, read `PRODUCT.md` and `DESIGN.md` first: `PRODUCT.md` defines product intent and `DESIGN.md` defines visual direction. Preserve both unless the current request explicitly asks to change them. Let `ui-flow` decide when a specialist skill is relevant instead of invoking every design skill automatically.
