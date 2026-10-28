---
name: ui-flow
description: Orchestrate frontend and UI work for components, pages, dashboards, charts, forms, navigation, layout, styling, responsive behavior, accessibility, animation, interactions, and redesigns. Use when UI work requires project context, component selection, specialist routing, implementation, or validation. Route to focused resources and specialists instead of loading every design skill.
---

# UI Flow

Act as the router for frontend and UI work.

Do not replace project instructions, component sources, design guidance, animation guidance, or testing specialists. Decide what the task needs and load only that context.

## 1. Establish context

Before substantial UI work:

1. Read relevant `AGENTS.md` instructions.
2. Read `PRODUCT.md` for product intent, behavior, and constraints.
3. Read `DESIGN.md` for visual direction.
4. Inspect the existing implementation before changing it.

For component work, follow the repository's documented component source and component instructions.

Do not let generic design advice override project-specific guidance.

## 2. Reuse before building

Prefer, in order:

1. Existing project component.
2. Existing installed dependency.
3. Project-approved component source or component browser.
4. External component source only when appropriate and available.
5. Custom implementation when existing options are insufficient.

Adapt sourced UI to the project rather than replacing the project's visual system or architecture.

Avoid unnecessary dependencies and unnecessary rewrites of working components.

## 3. Route specialists

Load only specialists relevant to the request.

### Components

Use the project's component source or component browsing workflow when a reusable primitive or polished existing solution may already exist.

### Motion

Motion is an important part of the Course Radar visual experience, especially on the landing page.

For landing-page design or redesign work, treat purposeful motion as part of the default visual direction and use the installed `animate` skill when implementing or designing that motion.

Consider motion for hero content, section transitions, scroll reveals, hover feedback, CTA interactions, and visual storytelling.

For workspace/product UI, use motion more selectively for state changes, feedback, loading, transitions, and orientation.

Motion should improve clarity, hierarchy, responsiveness, or perceived quality. Preserve accessibility and `prefers-reduced-motion`.

Do not use excessive or distracting animation.

### Visual exploration

Use an installed visual exploration or brand specialist when the user requests a new visual direction or the project has no meaningful visual direction.

Use Taste only when it is actually available in the current tooling.

Do not let visual specialists silently override `DESIGN.md`.

### UX and accessibility

Use a UX/accessibility specialist when keyboard behavior, responsive behavior, interaction design, accessibility, or complex usability decisions are central to the task.

### Review

Use Impeccable or the project's UI review specialist for significant UI changes such as:

- new pages,
- dashboards,
- major forms,
- navigation,
- redesigns,
- substantial charts,
- significant responsive work.

Skip heavy review for small local edits.

### Testing

Use the relevant testing workflow when interactions, functionality, or regressions require verification.

Never claim something was tested unless it was actually exercised.

## 4. Implement

During implementation:

- preserve existing behavior unless the request changes it,
- make targeted edits,
- follow existing architecture and styling,
- preserve accessibility and responsive behavior,
- preserve existing data flows,
- avoid unrelated refactors,
- avoid unnecessary abstractions or dependencies.

Do not automatically invoke every overlapping design skill.

## 5. Validate proportionally

For small changes:

- inspect the changed code,
- compare with nearby UI and project guidance,
- run lightweight relevant checks when useful.

For substantial changes:

- run relevant typecheck, lint, test, or build commands,
- inspect responsive and accessibility implications,
- use the appropriate review or testing specialist,
- fix meaningful regressions before finishing.

Report only what was actually verified.

## Priority

Resolve conflicts in this order:

1. Current user request
2. `PRODUCT.md`
3. `DESIGN.md`
4. Repository architecture and `AGENTS.md`
5. `ui-flow`
6. Specialist skills and external guidance

A specialist must not silently override higher-priority project context.

## Default flow

`UI request`

→ read project context  
→ inspect existing implementation  
→ reuse existing solution  
→ browse approved components if needed  
→ load only relevant specialists  
→ implement  
→ review/test proportionally  
→ finish