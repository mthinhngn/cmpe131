---
name: Course Radar — Connected paths
description: An editorial planning interface with an interactive prerequisite map.
colors:
  ink: "#151515"
  paper: "#ffffff"
  quiet-surface: "#f3f3f3"
  line: "#dedee0"
  muted: "#66666b"
  deep-ocean: "#0b4b5e"
  ocean-depth: "#082f43"
  ocean-node: "#dce9e9"
typography:
  display:
    fontFamily: "Radar Tight, Inter Tight, Arial, sans-serif"
    fontSize: "clamp(56px, 6.7vw, 96px)"
    fontWeight: 500
    lineHeight: 1.01
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Radar Sans, DM Sans, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "4px"
  product-frame: "6px"
spacing:
  unit: "4px"
  desktop-gutter: "56px"
  section: "104px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "16px 23px"
---

# Course Radar design system

## Overview

The `/` landing page is a working editorial proof of the product. Its visual language takes the user-supplied Chronicle reference's typographic precision, white canvas, tight spacing and hairline rules, then reserves Deep Ocean blue for the prerequisite diagram. The diagram is the first product experience and shows actual recorded relationships. The workspace routes have their own established styling.

## Colors

White paper and charcoal ink carry the page. Warm gray is used for the planning and catalog surfaces. Deep Ocean `#0b4b5e` is the diagram ground and focus color. Darker `#082f43` identifies the selected course inspector; pale blue-green course nodes contrast with the ground. Blue is not used as decorative site chrome. The focus ring uses the Deep Ocean accent.

## Typography

Self-hosted Inter Tight is the display voice: 500 weight, tight negative tracking, large two-line statements. Self-hosted DM Sans handles copy, controls and course data. The display scale reaches 96px on large desktop; section headings range roughly 42–63px. Data captions are small but not the sole carrier of essential meaning.

## Layout

Desktop content follows a rail up to 1328px wide with 56px outer gutters. The opening is typographic and leads into a full-width graph beneath it. Later sections use asymmetric editorial pairings, a table for catalog discovery, and a restrained center-aligned close. Rules separate surfaces; equal-size feature cards do not structure the page. The graph remains horizontally pannable when the available viewport cannot contain its full topology.

## Elevation & Depth

The page is mostly flat. Diagram nodes use a soft offset shadow only for the selected or hovered state, making focus readable against the saturated ground. Frames use fine borders, with minimal radius.

## Shapes

Buttons, graph nodes and the product frame use 4–6px corners. Tiny circles mark path connection points and the active path legend. There are no decorative pills or rounded card grids.

## Components

The map offers program switching, selected-course inspection, prerequisite highlighting, zoom, replay and add-to-plan. Course data and plan state come from the existing catalog context. Catalog search filters the selected program's local records and its add controls update the same in-session plan. The semester preview reads that plan; the week preview is labeled illustrative and directs users to listed sections. The map and external course requirements keep official source access visible.

## Prerequisite workspace reference (2026-10-26)

For `/prerequisite-chart`, the user-supplied `coursemap.zip` and screenshot guide the local visual treatment: near-white mint canvas (`#fbfdfc`), deep green text (`#183933`), pale mint borders (`#d9e5e0`, top accent `#a5d8c9`), and teal downstream connections (`#168873`). Course cards and contextual previews use 8px corners and soft offset hover shadows. Use a quiet line grid, circular connection ports, compact code/units headers, and clear separation between semester rows. Preserve brass prerequisite highlighting, dashed corequisites, textual status cues, and the real catalog data. Fit every semester on entry; retain wheel/pinch zoom and drag panning without zoom buttons. This is a route-specific adaptation; the landing and other workspace pages keep their established direction.

## Do's and Don'ts

- Let typography, rules and data density carry the identity.
- Use Deep Ocean blue for the graph and selected data states.
- Keep recorded source conditions and planning limitations visible.
- Keep navigation and controls semantically labeled with visible focus.
- Keep the workspace's separate visual system and data flows intact.
- Avoid fabricated academic outcomes, testimonials and enrollment claims.

## Landing reference replacement — 2026-10-26

The current `/` route follows the user-supplied `courseradar.zip` landing: white editorial chrome, the supplied navigation, split headline and action area, product preview, benefits, workflow, context section, closing action, and footer. The preview follows the separate screenshot: near-white mint grid, evergreen type, semester rows, two-column course cards, circular ports, dimmed unrelated courses, and solid teal prerequisite curves. This user-selected direction supersedes the older Chronicle landing direction above for `/` only. Workspace styling remains route-specific.

## Exact ZIP landing restoration — 2026-10-26
The latest user instruction supersedes all previous adaptations for `/`: reproduce courseradar.zip directly, including original sizing, spacing, fonts, copy, icons and CourseNetwork dashboard. Do not use the custom 1580px rail or screenshot-based replacement map. Workspace visual direction remains separate.

## ZIP v2 hero adjustment — 2026-10-26
Latest desktop direction: use courseradar (1).zip's split hero and sidebar-free hero window. Extend the right window nearly to the viewport edge (24px gutter), retain the ZIP copy, type and lower sections, and add a soft window shadow plus a gentle white fade at the right page edge, following the supplied Chronicle reference. Page-arrival motion is short and reduced-motion aware. This supersedes exact ZIP v1 hero geometry only; no mobile redesign requested.


## Overview browser-reference refinements — 2026-10-26

The user-selected `/overview` accent follows the prerequisite map: teal `#168873`, evergreen `#183933`, and pale mint `#a5d8c9`. Header actions align with the logo and navigation without inheriting the hero action margin. The hero charts follow the supplied reference's composition: a wide upper panel with two separate panels below, the right panel slightly lower. Use grid placement rather than overlapping absolute positioning. The illustrative-dashboard banner is removed at the user's request. These rules apply to the reference Overview only; retain its course content, section controls, and links to the SJSU workspace.

## Shared reference palette and editorial type — 2026-10-27

The user's five supplied references authorize a reusable palette and typography family across Course Radar. This is an available shared vocabulary, first applied to Degree Roadmap and its course detail panel; other pages retain their present appearance until adopted in their own scoped changes. These choices supersede the roadmap's Inter-only display and uniform evergreen/mint treatment. The existing Course Radar radar mark, interface conventions, content and data flows remain.

### Palette tokens

| Token | Value | Role |
| --- | --- | --- |
| `--cr-ink` | `#202d2e` | Deep charcoal text |
| `--cr-paper` | `#fcfcfa` | Near-white canvas |
| `--cr-cloud` | `#f2f3f1` | Quiet alternate year and section surface |
| `--cr-teal` | `#12494b` | Main route, primary actions, focus |
| `--cr-on-teal` | `#eff7f3` | Primary text on teal |
| `--cr-on-teal-muted` | `#bfd4d0` | Secondary text on teal |
| `--cr-cyan` | `#d1eef0` | Selected route stop and selection highlight |
| `--cr-mist` | `#e3eeea` | Plan fields and subtle active backgrounds |
| `--cr-line` | `#d6e2de` | Separators and borders |
| `--cr-muted` | `#586c6a` | Supporting text on light surfaces |
| `--cr-secondary` | `#6e8380` | Secondary large display text |
| `--cr-slate` | `#555d76` | Units and semester markers |
| `--cr-peach` | `#dac1b2` | Secondary warm palette reserve |
| `--cr-peach-soft` | `#f5eee8` | Flexible requirement-choice surface |

Colors are authored interpretations of the supplied reference images, not claimed exact extracted brand values. Use named roles rather than rotating colors arbitrarily. Teal and charcoal provide contrast; cyan and mist are grounds, not small text colors. Peach identifies flexible requirement choices without implying a warning or completion. Slate provides a quiet data contrast. Do not transfer reference logos, commercial copy or slide claims into the product. Gradients in the source images are optional visual inspiration, not a requirement; roadmap data remains on flat surfaces.

### Typography

Use local Instrument Serif regular (`public/fonts/instrument-serif-regular.ttf`, CSS family `Radar Editorial`) for a limited editorial layer: page title, year-section titles, closing statement and course-panel title. `--cr-display` names that stack. The regular italic asset is available but is not applied by default. Use `--cr-interface` (Inter, Arial, sans-serif) for body, navigation, course names/codes, controls, units and prerequisite/section data. Never make dense operational content serif merely for decoration.

Roadmap display sizes: hero 58–84px, year titles 34px, closing statement 40px, drawer title 34px. Course names remain 13px and ordinary section headings 16–18px. Display tracking stays between -0.025em and -0.015em; body line height stays 1.5–1.75. Reference-inspired serif is an explicit user-authorized expansion of the earlier landing typography direction, not a reason to restyle every existing page.

### Adoption and implementation

`src/roadmap-palette.css` declares the reusable `--cr-*` tokens and self-hosted display face; route selectors apply them only to roadmap and its drawer. Existing roadmap CSS consumes these tokens. Later page adoption should move the token declarations into a shared imported foundation without changing their role names. Preserve all four years/eight semesters visible by default, jump navigation, filters, planning and completion. Do not add decorative animation to this palette change.

## Desktop navigation consistency — 2026-10-27

Use Semester Planner as the shared desktop header/navigation geometry: 72px header, maximum 1344px including 32px horizontal padding, 44px between header regions, 27px between navigation labels, 12px regular Inter. The active item uses dark text with a 2px `#168873` teal rule aligned to the bottom of the header, spanning the label width. This combines the Planner's underline position/spacing with Overview's active accent. Remove pill fills, shadows and rounded active tabs. Prerequisites explicitly marks its active navigation link. These rules apply at desktop widths of at least 1000px; existing smaller layouts remain unchanged. `src/product-navigation.css` is imported after each entry's page styles so all active header variants use the same geometry.

## Typography correction — 2026-10-27

The user rejected the font change. Retain Inter throughout the roadmap, including hero, year headings, closing copy and course-detail title. Instrument Serif adoption described above is withdrawn; do not apply it to other pages. Restore previous display sizing/weights: hero 48–72px/500, year heading 26px/500, closing 30px/500, drawer title 27px/500. The reference palette and shared navigation spacing/teal underline remain approved. Palette references authorize color choices, not a change to the existing typography.

## Roadmap hero and inspection refinement — 2026-10-27

Keep roadmap hero typography Inter with neutral #101010 first line and #767676 second line, matching other product heroes. Teal/cyan/slate/peach remains in the roadmap data surface rather than tinting hero text. Align hero supporting copy to the left of its grid column. The roadmap course detail is a bounded sheet with16px desktop inset,560px width,10px corners and24px Inter heading. Topic summaries describe the subject directly; provenance stays in catalog/source links. Pointer arrival/dismissal uses32px horizontal travel and opacity over200ms with strong ease-out; keyboard operations remain immediate, and reduced motion keeps a fade without displacement.

## Route-band fade and semester rhythm — 2026-10-27

The year-navigation band owns a local `--route-band: #335c5d`; this does not replace shared `--cr-teal` across the app. A static vertical white/beige alpha overlay fades to transparent over the top80px, revealing the green ground. Labels sit below the fade on the green, and light node discs retain dark readable numerals. This treatment is shared across this route's widths rather than tied to the annotated1242px viewport. Semester headers retain Inter with20px medium titles,11px counts,14px regular units and plain sequence numerals; redundant “recommended” under every unit total is removed, with recommendation context retained in year/semester content.

Pointer course-sheet entry uses WAAPI transform/opacity for250ms and strong ease-out;28px translation enters from the right. Pointer exit retargets from the current computed state over200ms, so early dismissal does not restart arrival. Backdrop fades over200ms. Keyboard entry/dismissal remains immediate, and reduced motion removes travel. Static course data does not animate independently.

## Roadmap annotation correction — 2026-10-27
The route-band fade runs horizontally from white/beige on the left to #335c5d on the right. The first two year labels use dark teal text on the light region; the final two retain light text on green. This supersedes the earlier vertical fade. The Official guide action belongs on the catalog-context line below the hero, using the programUrl destination; it is omitted from the roadmap header only.

Header/fade correction: year fade uses distributed horizontal alpha stops over78% of the band for a softer blend. Roadmap navigation uses shared auto margins after removal of its header guide. Desktop active underline is a2px bottom border on the72px navigation link, rather than a pseudo-element vulnerable to legacy display rules.

Gradient correction: the year band is a single continuous90-degree blend from #f5f0e6 at0% to #335c5d at100%, without opacity stops compressing the transition into the middle. Year3 uses dark copy on its intermediate ground; Year4 retains white copy.

Route-band endpoint clarification: gradient reaches full #335c5d at the right endpoint of the horizontal connector; the tail to the outer edge stays solid. Shared route-local --route-end-inset:65px owns both positions.

## Exact header identity — landing as source of truth — 2026-10-27

All product headers use `CourseRadarBrand` from `src/CourseRadarBrand.tsx` and its single `course-radar-brand.css` source. Match the incumbent landing exactly: original radar SVG geometry with a27×27px box;9px icon-to-wordmark gap; Inter15px, line-height1.5, letter-spacing-0.055em; Course weight600 in #101010, Radar weight400 in #717171, no added space or negative margin between the two words. The component links to `/` using document navigation, preserving stylesheet boundaries. Header identity has no route-specific size or font variants. Home, Overview, Prerequisites, Semester Planner and every shared Workspace route adopt the same component. Footer variants remain separate because this instruction concerns the header.

Navigation label sizing and spacing remain owned by shared product-navigation.css:12px Inter/400,27px gap and common72px header, with teal active underline. Different route destinations/actions do not justify changing wordmark metrics. Landing visual identity overrides older workspace brand rules.


## Shared desktop content rail — 2026-10-27

The user selected Overview as the horizontal spacing authority for every product page except the landing. At widths of at least1000px, main content uses min(100% - 88px, 1380px): a centered1380px maximum and44px minimum side gutters. Schedule, Course, Planner, Roadmap and Recommendations follow this rail through product-layout.css. Workspace source rows and footers align with their main content. This supersedes their route-local1200/1280/1440px content widths. Existing shared header/context geometry and all smaller-width layouts remain separate; the landing is unchanged.


## Course Explorer — Graphite / Porcelain — 2026-10-27

### Visual atmosphere
A restrained desktop planning workspace: balanced density, one graphite parent shell and a lighter inset weekly schedule. Color establishes depth while the existing landing-derived spacing, typography and nested geometry remain authoritative.

### Color palette and roles
- Graphite `#27282f`: shared outer shell and catalog ground.
- Graphite raised `#30323a`: expanded course rows and section details.
- Porcelain `#f8f8fa`: inset weekly calendar.
- Charcoal ink `#30333c`: primary text on light surfaces.
- Silver text `#f0f0f3` and muted silver `#bfc1ca`: primary and supporting text on graphite.
- Neutral muted `#686c78`: secondary calendar text.
- Slate `#526b8f`: the sole decorative accent for actions, selection and focus; pale `#e5ebf3` and `#eef2f8` are its selected and preview grounds.
- Fine light border `#dedfe5` and dark separator `#40424b`: surface boundaries.
Warnings/conflicts retain their semantic amber/rust colors and text labels. No neon, pure black, gradients or colored glow.

### Typography
Retain the existing Inter family, sizes and tabular hour numerals. This color-only adoption does not authorize the taste-design skill's font replacement.

### Components
Catalog rows remain part of the shell. The calendar alone receives inset elevation. Match hover, expanded, preview, selected, button, scrollbar and keyboard-focus colors to these roles. Keep the 76px time column and 16px left/12px right label padding.

### Layout
Keep the existing desktop-only resizable composition, collapse/focus behavior and nested calendar insets. The user's desktop-only instruction overrides the skill's mobile-collapse defaults.

### Motion and interaction
Preserve existing interactions and motion. No additional loops, list reveals or animated color treatments are part of this palette change.

### Anti-patterns
No new cards, decorative metrics, fabricated content, mixed warm/cool gray systems, neon/glows or unrelated route recoloring. Landing, navigation and other routes retain their established palette.

### Course identity colors — 2026-10-27
Course blocks are categorical data, so the single slate chrome accent does not limit their colors. Use eight muted families: sage, sky, sand, lilac, rose, aqua, apricot and slate. A deterministic course-code hash assigns the family consistently across days, LEC/LAB components and saved-section chips. Colors may repeat across a large catalog; course codes remain visible. Preview preserves the course color and adds a dashed border; conflicts retain rust with explicit warning text/icon. This supersedes the earlier monochrome schedule-block treatment only.
