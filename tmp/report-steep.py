from pathlib import Path
p=Path('IMPLEMENTATION.md')
s=p.read_text(encoding='utf-8-sig') if p.exists() else '# Implementation\n'
entry='''
## 2026-10-26 — New Steep landing

### Implemented

The attached Steep reference replaces the earlier landing visual direction. Concept: connected courses become a clearer path. White paper, graphite, locally licensed Instrument Serif regular/italic and DM Sans, paired pill actions, flat mist panels and one peach assistant panel. The hero uses two exactly equal desktop columns. Its right half contains a real CMPE 30 → CMPE 50 → CMPE 131 relationship, with Path / Semester / Week controls and explicit replay.

The catalog demo searches real Computer Engineering records, announces result counts, opens prerequisite conditions, and adds/removes courses from a local plan. Empty search and empty plan states are implemented. Weekly examples select real, scheduled, non-conflicting offerings from the dated Fall 2026 snapshot. The week is intentionally independent of the demo plan and says so. Assistant content describes review-before-apply without pretending to run a live request.

### Architecture and affected files

- `src/SteepLanding.tsx`: new route component and local demo state. `src/main.tsx` changes only its landing import; all route paths and providers are preserved.
- `src/landing.css`: new scoped visual and responsive system; `src/theme.css` remains the existing prefixed Tailwind/no-Preflight foundation.
- `DESIGN.md`, `.impeccable/design.json`, `.impeccable/landing-steep.tokens.json`, `docs/surfaces/landing-steep.md`: current landing documentation. Existing workspace composition guidance is retained. Historical landing brief is marked superseded.
- Original `src/Landing.tsx` and `src/landing.styles.ts` are retained as inactive history. The original component file was locked during a write attempt; the new component avoids that contention.

### Decisions and trade-offs

The user-pinned Steep direction supersedes the first attachment's general accent-color freedom. Instrument Serif is a locally available, licensed editorial alternative; commercial Signifier/Sohne are not falsely claimed as installed. Native links/buttons/input are sufficient; reviewed local shadcn button source did not justify adding Radix dependencies. No new package, image generation, stock imagery, testimonial or fabricated academic outcome is needed.

Motion has one purpose: explanation of prerequisite progression. CSS stroke-dashoffset draws the connector over 2.6s, course artifacts arrive at 160ms intervals with the animate skill's ease-out curve. Replay remounts the current experience. Reduced motion preserves a readable static chain. Hover transforms are fine-pointer gated.

### Verification

Verification results will be appended after the final build, interaction checks and independent Impeccable review. No commit, push, deployment or PR is performed.

'''
p.write_text(s+'\n'+entry,encoding='utf-8')
