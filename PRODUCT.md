# Course Radar product

## Purpose

Help SJSU students inspect catalog requirements, understand recorded prerequisites, track course completion, plan personal terms, and compare listed sections. Personal plans are planning aids, not official degree audits or university enrollment records.

## Current behavior

- Home introduces the product with an illustrative animated preview. Its data and scripted assistant replies are separate from real accounts.
- Overview, Schedule, Planner, Roadmap, and Account use the same catalog and PostgreSQL-backed planning state. Supported program choices come from the imported catalog; evidence coverage may be incomplete.
- Account owns saved profile/program preferences and the first academic term. Signed-in users finish setup before entering their personal workspace. Guest and account workspaces remain separate.
- Completion is explicit. Choosing a semester or completing a prerequisite never automatically completes a course. A completed course retains its saved placement and can be moved.
- Planner supports numbered Fall/Spring terms and persisted Winter/Summer terms, including empty terms. Deleting a term removes its placements and associated meetings while preserving completion and official requirements.
- Course-only plan edits save without section prompts. Section choices belong to explicit Schedule actions. Moving terms preserves grouped courses/statuses, recalculates dates, and clears meetings for changed dates.
- Roadmap course cards expose saved completion controls. GE, technical, and university requirement cards expose a course-only picker with recorded eligibility filters. Choice and suggested placement save atomically; personal choices do not rewrite official requirements.
- A GE candidate requires captured satisfaction evidence. Missing catalog data must not be filled with invented eligibility. Minimum-grade, consent, equivalency, and degree-credit claims need official review.
- One `ChatWidget` serves every workspace page. Kimi coordinates Course Action and Web Search. Intent, deterministic authorization, API execution, and acknowledgement remain separate. Never acknowledge a saved action before the authenticated workspace API accepts it.
- Account persistence, request replay, conflict handling, retry, and Undo protect saved work. Failed saves remain visible and recoverable.

## Boundaries

Sections, meeting times, instructor matches, and seat availability are dated records, not live enrollment guarantees. Unmatched instructors are not linked to guessed review profiles. Program sequences must retain official evidence or be labeled drafts. Students must verify requirements, grades, course availability, and enrollment against official SJSU sources.

Desktop is the required verification target. Preserve the current approved screens, shared navigation, intended motion, accessibility behavior, and a single assistant surface. Visual guidance is in [DESIGN.md](DESIGN.md).
