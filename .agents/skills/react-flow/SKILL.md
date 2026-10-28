---
name: react-flow
description: Build and refine Course Radar prerequisite diagrams with @xyflow/react, including draggable nodes, path focus, course popups, and pan/zoom. Use for the product roadmap graph, not static illustrations.
---

# Course Radar React Flow

This is project-authored integration guidance, not a skill supplied by xyflow.
Upstream: https://github.com/xyflow/xyflow
Official API: https://reactflow.dev/api-reference
Toolbar example: https://github.com/xyflow/xyflow/tree/main/examples/react/src/examples/NodeToolbar

- Follow the project ui-flow workflow and DESIGN.md. The installed dependency is `@xyflow/react`; do not install the xyflow monorepo.
- The full reference Roadmap uses `src/RoadmapFlow.tsx`, hosted by `LandingCourseNetwork.tsx`. The landing retains its illustrative SVG. The catalog workspace has a separate `PrerequisiteChart.tsx`.
- Read course and semester facts from `src/data.ts`. Use `getHighlightedPath` in `src/prerequisiteGraph.ts` for upstream, downstream and symmetric corequisite focus. Do not infer extra prerequisite edges.
- Use controlled `useNodesState` and preserve existing positions when changing focus or search. Keep nodeTypes outside render. Provide a concrete canvas height before fitting the viewport.
- Course selection raises the selected card, highlights its path and shades unrelated nodes/edges. Use NodeToolbar for anchored details; choose its side and alignment so edge nodes retain readable popups. Blank-pane click, Escape and a close button clear focus.
- Edges are solid straight paths; preserve corequisite meaning using text/color rather than animated dashes. Nodes and semester labels can be dragged; users cannot change academic prerequisite records by connecting or deleting nodes.
- Keep keyboard node selection, visible focus, pan, pinch and zoom. Test graph traversal with `node --test tests/prerequisites.test.mjs`, then typecheck/build. Report browser checks separately from code checks.
