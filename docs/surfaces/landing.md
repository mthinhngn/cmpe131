> Superseded for route `/` on 2026-10-26 by [landing-steep.md](landing-steep.md), following the user-supplied Steep reference. The historical notes below are retained for traceability.

# Course Radar landing page

Route: `/`. Mode: Persuade, with product education as its primary job. Desktop acceptance: 1920×900, 1440×900, and 1280×900. The workspace remains at `/overview`.

## Direction

Follow the current `DESIGN.md` structure and its latest landing-specific rules. The selected concept is an **open planning signal**: courses gather into semester rows and resolve into a week. The diagram is native SVG with in-page links, not an image or a fake dashboard. Preserve the product story: explore courses → understand prerequisites → map semesters → build a week → review an AI proposal.

## Desktop composition and rail

- Header: 80px, wordmark left, single-line centered navigation capsule, action right that scrolls to the demonstration.
- Hero: exact 50/50 columns. Left-aligned copy is vertically centered in its half; one unified open diagram is centered inside the right half. No element crosses the midpoint. One short heading, supporting sentence under 20 words, one primary CTA. No eyebrow, scope strip, trust claims, or text beneath the CTA.
- Rail: `min(1600px, calc(100% - clamp(64px, 6.9vw, 160px)))`.
- Course search: open list beside introductory copy, with up to three real results and an announced result count.
- Prerequisites: spacious graph on a quiet neutral surface; hover/focus traces ancestors and descendants. Outline, dashed unrelated surfaces, path thickness and readable status text supplement color.
- Semesters: vertical selector and reviewable course rows. Distinguish roadmap examples from personal session drafts.
- Week: full-width listed-section calendar, followed by normal-size snapshot disclosure and concise assistant explanation.
- Close: one CTA using the same “Explore courses” label and destination as the hero; factual footer.

## Typography

Local Space Grotesk 400 for headings; local Manrope 400–600 for body, controls and product text. Hero 58–78px, section headings 30–42px, body 16–18px, working secondary text 15–16px. No serif or decorative uppercase labels.

## Palette and surfaces

| Role | Value |
| --- | --- |
| Canvas | `#ffffff` |
| Graphite | `#211d1f` |
| Ash | `#f0edef` |
| Fog | `#f7f5f6` |
| Ivory | `#eae5e7` |
| Steel | `#51494d` |
| Mist | `#dcd6d9` |
| Wine | `#76263d` |

Neutral tones plus Wine as the sole deep strong accent, authorized by the user's updated brief. No green, blue, gradients, dark sections, glass, glow or decorative shadows. Use 12px control corners, 16–20px course/data surfaces, and a full pill only for navigation.

## Content and interactions

All links stay on `/`. Hero stages and navigation link to the corresponding sections. Local search filters the reviewed program catalog and announces its result count. Prerequisite nodes support pointer hover and keyboard focus. The semester selector changes the demonstration without modifying a plan. Existing personal context is displayed when present; otherwise the list clearly identifies a roadmap example. The displayed semester range is intentionally limited to three example semesters.

Hero course labels summarize catalog subjects without codes or metadata. The detailed graph uses real course records. Weekly sections come from the reviewed local snapshot for the inherited program, not a live enrollment API. Keep deterministic overlap lanes and readable labels. Show the capture date in normal body text. The assistant explanation describes review, warnings and applying a proposal; it does not simulate an AI response or imply automatic decisions. No invented outcomes or usage claims. State program scope once near the explorer.

## Motion

One visible explanatory sequence: copy entry, signal stroke draw, staggered course appearance, reorganization into semester rows, then weekly block settlement. Use CSS transforms/opacity and SVG stroke properties with the existing landing ease-out/timing tokens. Related elements stagger by 60ms. IntersectionObserver triggers section reveals once; no replay or infinite animation. Fine-pointer-only hover motion. Motion is supplementary to the static final composition.

## Architecture boundary

`src/Landing.tsx` owns composition and local demo interactions. `src/landing.styles.ts` holds `cr:`-prefixed Tailwind v4 recipes. `src/theme.css` holds opt-in landing tokens and keyframes, with no global Preflight. No new primitive/dependency is needed. Providers, records, schedule utilities, workspace styles/routes and assistant execution remain intact.

## Verification record

See the latest entry in `IMPLEMENTATION.md`. Distinguish rendered desktop review, browser interactions, motion inspection, automated tests/type/build, and Impeccable detector results. Do not claim mobile, screen-reader, live API or broad regression validation.

> Current authority (2026-10-26): the user's latest instruction requires an exact reproduction of `courseradar.zip`. Use `src/ReferenceLanding.tsx`, `src/LandingCourseNetwork.tsx` and the unchanged ZIP CSS at `src/reference-landing.css`. Previous Steep/Chronicle composition and 1580px rail notes are superseded for `/`. The ZIP's own 1280px and 1190px caps and all original responsive spacing apply.
