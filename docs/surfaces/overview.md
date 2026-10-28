# Overview

Route: `/overview`. Mode: Operate. Acceptance: desktop, 1440×960 and 1280×900.

## Direction contract

THESIS: Continue the landing page's visual language in a personal workspace where students can inspect progress and act on real courses.

OWN-WORLD: Inherit the landing's warm paper `#fdfcf9`, ash `#f0efeb`, graphite `#24231f`, orange `#d75c34`, brass `#816729`, regular Inter Tight headings, DM Sans controls, capsule navigation, sharp primary actions, and flat softly rounded product surfaces. Seed: none; user-pinned existing landing authority, code-led Operate extension.

STORY: A student enters from the landing, checks personal progress, opens a course to mark completion or plan it, and follows semester, prerequisite, or schedule tools as needed. All named-course counts use the selected catalog and existing session state.

FORM: Compact split introduction and degree-progress panel; wide course working area beside a narrow guidance rail; interactive semester distribution below. A clear planner action leads. Course filters/search and semester choice remain visible. The existing course drawer owns completion, planning, sections, and schedule selection. List changes animate once over 450ms; progress segments transition over 650ms. These limited motions remain perceptible under the existing user preference, including an OS reduced-motion setting.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Quality bar

The existing landing is the chosen world, not a new concept. Match its logo geometry, 1200px alignment, paper/ash hierarchy, regular typography, sharp graphite actions and restrained accents. Preserve full program/context/status information. Give the working area more priority than the previous full-height hero. Real course titles, units, state labels, source links, and course details carry the content. No fabricated metrics or product illustrations. No new raster assets.

## Implementation and verification

`src/Overview.tsx` derives progress, course views and semester distribution from CatalogContext. `src/overview.css` scopes the new visual language; `.workspace-overview` adjusts shared chrome on this route. `src/Workspace.tsx` re-exports Overview and preserves providers/routes. No new dependencies or persistence changes. The upstream shadcn/ui button implementation and existing adapted primitive were inspected; native filter buttons, input and select require no added primitive.

Desktop captures: `.impeccable/review/overview/desktop-1440.jpg`, `desktop-1280.jpg`; landing authority: `landing-reference.jpg`. Search, empty recovery, course completion, semester plans, program switching, chart navigation, section selection into the explorer's weekly schedule, and Escape focus return were exercised. Test state was cleared. Final review disposition and build results are recorded in IMPLEMENTATION.md.

Mobile, screen-reader traversal, live catalog backend and actual assistant generation were not verified. Existing backend-unavailable status/retry remains visible. Existing bundle-size advisory remains.
