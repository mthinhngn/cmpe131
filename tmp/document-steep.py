from pathlib import Path
p=Path('DESIGN.md')
old=p.read_text(encoding='utf-8-sig')
marker='### Workspace route composition'
workspace=old[old.index(marker):old.index("## Do's and Don'ts",old.index(marker))] if marker in old else ''
p.write_text('''---
name: Course Radar — Steep landing
description: Editorial product landing at /; workspace keeps its independent visual system.
colors:
  ink: "#17191c"
  paper: "#ffffff"
  mist: "#f2f2f3"
  fog: "#fafafb"
  muted: "#626671"
  peach: "#fbe1d1"
  sienna: "#5d2a1a"
typography:
  display:
    fontFamily: '"Radar Serif", Georgia, serif'
    fontSize: "clamp(70px, 6.25vw, 90px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  artifact: "20px"
  panel: "24px"
  pill: "9999px"
spacing:
  group: "24px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "13px 24px"
    height: "52px"
---

# Course Radar design system

## Overview

The user-supplied Steep reference is the visual authority for the new landing route `/`. The world is editorial product clarity: white canvas, regular serif headlines with italic phrases, quiet sans UI, paired pill actions, floating product artifacts, and one peach proposal panel. Previous landing compositions and palette rules are superseded. Workspace routes retain their separate styling.

## Colors

Paper white dominates. Ink carries headings and actions; Mist and Fog organize product demonstrations. Muted text is darkened from the reference to support contrast. Peach and Sienna appear together once, in the assistant proposal panel. No other chromatic roles, invented metrics, or dark decorative sections.

## Typography

Locally licensed Instrument Serif regular/italic is exposed as Radar Serif; it is an available editorial alternative to the reference's commercial Signifier. Locally hosted DM Sans supplies readable UI text. Headlines stay weight 400. Hero 70–96px, sections 48–64px, body 16–18px. Use italic phrases sparingly.

## Layout

A centered 1200px rail has 48px desktop outer gutters where space is limited. Hero uses two exactly equal columns, with no center crossing. Important copy and actions fit a 900px-high desktop viewport. At 760px and below the hero stacks. Section spacing varies 80–120px to distinguish exploration, planning and the close. See docs/surfaces/landing-steep.md for the current route contract.

## Elevation & Depth

Most surfaces are flat. White course artifacts and the week receive soft offset shadows: 0 12px 36px -12px with low-opacity ink. Broad content surfaces have no shadows.

## Shapes

Pill actions; 24px panels; 20px course artifacts; circular add/remove buttons. Tiny schedule blocks use 8px corners to preserve space. Semantic controls remain recognizable and visibly focused.

## Components

Course search filters local catalog records and opens prerequisite details. Add/remove controls affect only the local demo plan. Hero process buttons expose path, semester and week views. Replay replays the current view. Weekly meetings come from conflict-free listed sections and remain independent of demo-plan changes. A static, explicitly labeled assistant workflow explains review before apply.

Motion explains course connection: a 2.6s SVG stroke draw and 850ms staggered arrivals. Reduced-motion users retain the static diagram. Hover transformations are gated to fine pointers; focus uses an offset ink outline. Tailwind remains prefixed `cr:` without global Preflight; landing CSS is route scoped.

'''+workspace+'''
## Do's and Don'ts

- Keep supplied Steep typography, monochrome hierarchy and rare peach punctuation.
- Use actual course records and dated snapshot disclosures; no invented outcomes.
- Preserve workspace providers, routes, styling and assistant behavior.
- Do not revive old landing sections, wine accents or Space Grotesk display rules.
- Keep all landing actions local and make demonstration limits readable.
''',encoding='utf-8')
Path('.impeccable/landing-steep.tokens.json').write_text('''{"scope":"/","source":"src/landing.css","colors":{"ink":"#17191c","paper":"#ffffff","mist":"#f2f2f3","fog":"#fafafb","muted":"#626671","peach":"#fbe1d1","sienna":"#5d2a1a"},"type":{"display":"Radar Serif","body":"DM Sans"},"radius":{"pill":"9999px","panel":"24px","artifact":"20px"},"motion":{"easeOut":"cubic-bezier(.23,1,.32,1)","pathDuration":"2.6s","arrivalDuration":"850ms"}}''',encoding='utf-8')
