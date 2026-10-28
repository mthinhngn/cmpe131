---
name: Course Radar
description: Editorial planning interface for SJSU degree and schedule data
colors:
  ink: "#17191c"
  paper: "#ffffff"
  mist: "#f2f2f3"
  fog: "#fafafb"
  slate: "#777b86"
  blush: "#fbe1d1"
  sienna: "#5d2a1a"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(68px, 6.4vw, 90px)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  card: "24px"
  artifact: "20px"
  input: "16px"
  pill: "9999px"
spacing:
  unit: "4px"
  card: "20px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
---

## Overview

**Creative North Star: “The planning spread.”** Course Radar places actual degree data around calm editorial type. The first viewport is spacious, while the working sections below make course actions easy to scan. Charts show recorded roadmap units and personal draft state; they never suggest an official audit or live enrollment status.

## Colors

Paper is the dominant canvas. Mist and fog divide working regions quietly. Ink carries actions and primary text. Blush is reserved for one emphasized surface or soft hero wash. Sienna draws chart marks and text on blush. Slate marks secondary information; informative small text may use the darker `#565a63` seen in the Overview for legibility.

## Typography

Source Serif 4 at weight 400 is the shipped Signifier substitute for large editorial headings. Inter handles navigation, controls, descriptions, and data labels. Use tabular numerals for quantities. Keep display copy short enough to stay legible among data artifacts.

## Layout

The content container is 1200px wide with 24px side padding. Desktop Overview centers its headline and positions three live data artifacts around it. Subsequent sections use a course list with a supporting term panel and plain editorial navigation rows. Reflow rules are defined in `src/steep.css`; the requested review target for this iteration is desktop.

## Elevation & Depth

Most content cards are flat mist surfaces. Only floating product artifacts have a soft, offset shadow. The Overview's subtle peach and gray wash sits behind content and carries no information. On page load, the title and artifacts enter once; chart bars and line marks draw in sequence. On desktop scroll, the editorial title scales down and fades while the working course section arrives. The sticky header keeps navigation available during this handoff.

## Shapes

Cards use 24px corners; small raised artifacts use 20px. Inputs use 16px. Buttons and compact controls are pills. Avoid adding new corner sizes without a specific component need.

## Components

Primary buttons are filled ink pills; secondary buttons use an ink outline. Course rows present code, title, recommended semester, snapshot availability, and a separate planning action. The course title opens details. Data cards label the source and meaning of each number, and chart SVGs or images have descriptive accessible names.

## Do's and Don'ts

- Do use real catalog, roadmap, plan, and section data for charts and metrics.
- Do keep session-draft and dated-snapshot limits visible near the data.
- Do use official SJSU links where students need to verify a decision.
- Don't introduce fabricated outcomes, testimonials, or enrollment guarantees.
- Don't repeat the same metric in decorative cards without a distinct purpose.
