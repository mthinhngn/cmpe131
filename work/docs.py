from pathlib import Path
p=Path('DESIGN.md');s=p.read_text(encoding='utf-8-sig');replacements={'radar-ink: "#171717"':'radar-ink: "#211d1f"','radar-ash: "#f1f1ef"':'radar-ash: "#f0edef"','radar-fog: "#f7f7f5"':'radar-fog: "#f7f5f6"','radar-ivory: "#eceae5"':'radar-ivory: "#eae5e7"','radar-steel: "#4b4b4b"':'radar-steel: "#51494d"','radar-mist: "#dededb"':'radar-mist: "#dcd6d9"','radar-ember: "#e44a2e"':'radar-wine: "#76263d"','red-orange accent':'deep wine accent','red-orange marks':'deep wine marks','red-orange accent':'deep wine accent','restrained red-orange accent':'restrained deep wine accent'}
for a,b in replacements.items():s=s.replace(a,b)
s=s.replace('along with the current catalog context','along with the current catalog context')
s+='''

### Landing route `/` — Open planning signal, current palette (2026-10-26)

This update follows the existing document structure, typography, desktop rail, product story, and implementation boundary. It supersedes earlier landing-only palette and offset-preview descriptions. The user explicitly requested a fresh composition, then authorized a new palette with neutral tones and one deep strong color, excluding green and blue. Workspace guidance above remains separate.

- **Composition:** Keep a compact 80px header with centered capsule navigation. The hero is two exact equal columns with no gap: concise left copy and one open, interactive planning diagram in the right half. The diagram has no large backing panel and no layered miniature dashboards. Courses gather into semester rows, then settle into a week along one continuous wine signal. Each diagram stage anchors to its corresponding demonstration.
- **Current colors:** Canvas White `#ffffff`; Graphite `#211d1f`; Ash `#f0edef`; Fog `#f7f5f6`; Ivory `#eae5e7`; Steel `#51494d`; Mist `#dcd6d9`; Wine `#76263d`. These are neutral surfaces plus one deep strong accent. Wine replaces Ember on `/`: primary actions, selected semester, course signal, and one meaningful underline. No green, blue, second bright accent, gradients, dark sections, glow, or decorative shadows.
- **Type and shapes:** Retain local Space Grotesk headings and Manrope controls/body. Keep 12px controls, 16–20px course/data surfaces, and a navigation-only pill. Readable product labels and disclosures remain 15–18px; the hero uses large labels without course codes or metadata.
- **Narrative rhythm:** Course exploration is an open search/list with introductory copy alongside it. Prerequisites occupy one spacious graph on Fog. Semester planning uses a vertical semester selector with a full-width review list. The listed-section week spans the rail, followed by a concise reviewable AI proposal explanation, focused close, and factual footer. No standalone institutional banner.
- **Motion:** Purpose is explanation, at first-visit frequency. Reuse the landing 620ms strong ease-out token for entrances, SVG stroke drawing, course-to-semester translation, and weekly block settlement; related course/block arrivals stagger by 60ms. The longer course choreography is a finite explanatory sequence. Section reveals occur once. Fine-pointer hover feedback is brief. No loop or replay. The existing project policy on OS motion suppression remains unchanged.
- **Scope:** Desktop only, reviewed at 1920×900, 1440×900, 1280×900. Keep `/overview`, providers, catalog records, schedule logic, assistant behavior, workspace CSS and shadcn defaults intact. `docs/surfaces/landing.md` records the current surface contract; `IMPLEMENTATION.md` records actual checks and limits.
''';p.write_text(s,encoding='utf-8')
p=Path('docs/surfaces/landing.md');p.write_text('''# Course Radar landing page

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
''',encoding='utf-8')
