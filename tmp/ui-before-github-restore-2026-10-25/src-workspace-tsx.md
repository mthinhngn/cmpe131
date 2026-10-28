---
version: 1
slug: "src-workspace-tsx"
primary_target: "src/Workspace.tsx"
related_targets: ["src/App.tsx","src/PrerequisiteChart.tsx","src/Recommendations.tsx"]
---

# Course Radar workspace redesign

Scope: The complete Course Radar web workspace: overview, course explorer, degree roadmap, prerequisite chart, semester planner, and scheduling assistant. Mode: Operate.

Audience and job: SJSU students use the 2026-2027 roadmap and course data to understand recorded prerequisites, mark completed work, plan personal semesters, and compare listed sections. Success is a clear, reviewable planning picture. Official SJSU sources remain authoritative.

Constraints: Preserve existing routes, catalog and schedule data, course actions, filters, selection, and assistant behavior. Keep draft and snapshot limitations explicit. Do not add unsupported proof, partner marks, or outcome claims. The user's Steep style reference and supplied overview screenshot are the visual authority. The user requested desktop scope for this pass.

## Direction contract

THESIS: Make degree requirements feel like a legible path through real catalog data. The opening has an editorial focal headline with live roadmap charts around it, followed by direct planning actions.

OWN-WORLD: Steep's white canvas, mist and fog surfaces, near-black text, Source Serif 4 display at weight 400, Inter body, pill controls, one peach accent, sienna chart strokes, and subtle elevation for floating data artifacts.

STORY: Students see what the catalog records, understand which courses connect, then decide what to mark or plan. Data source, personal draft state, and snapshot limits remain visible.

FIRST VIEWPORT: A desktop navigation header sits above a centered oversized serif headline. A roadmap unit bar chart floats to its left; a planning progress ring sits to its right; a semester load line chart anchors the lower left. Two planning links sit beneath the headline.

FORM: User-pinned Steep style reference and overview screenshot. No generated concept roll was used.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
