# Deployed UI parity

## 2026-11-27: synchronize the local desktop UI

### Problem and scope

Production was built from `31165b5`, but the active local checkout still contained
uncommitted UI work. In Schedule, professor ratings rendered without the companion
flex/gap CSS. The local radar mark, calendar typography, compact week heading,
shared navigation details, and other workspace refinements were also absent.

This change transfers 29 differing UI/source/asset files onto current `origin/main`.
It includes the actual local UI for Account, Overview, Schedule, Planner and
Roadmap, shared styles/header, and the SVG favicon. The existing Home/showcase and
merged chatbox code are retained; they already match the local implementation.

### Decisions and compatibility

- Reuse the existing React components, plain CSS, fonts and `SelectionMenu`.
  No new dependencies or parallel screen implementations.
- Keep the transcript loading/error/Retry fix from `33b68db` while carrying over
  local Account copy. Copying the older local Account file verbatim would remove
  that merged fix.
- Transfer both sides of component/style changes: professor metrics, radar mark,
  shared header, searchable What-if picker, Overview chart/legend refinements,
  Planner scrolling subject chips and condensed copy, and Roadmap progress meter.
- Retain the catalog, schedule and authenticated planning data paths. Backend,
  agent, database, account API, chat transport, and deployment configuration are
  unchanged. This is a frontend source synchronization, not a data migration.
- Personal plans, selected sections, saved panel split widths and dated catalog
  counts can differ between localhost and production even with matching UI code.

### Verification

- `npm run build`: passed (TypeScript and Vite production build).
- `npm test`: 55 passed, 1 failed. The existing technical-elective test expects a
  major-aware third argument that committed `courseSubject` does not implement.
  Exporting the unchanged test and its source dependencies directly from
  `origin/main` reproduces the identical failure (`university` vs `technical`).
- Desktop browser verification used the production build served locally, backed
  by the real running local API/agent. An ignored validation-only proxy forwarded
  the canonical development Origin because the local API rejects the temporary
  preview port. No mocked ratings, catalog responses or data fixtures were used.
- Schedule: expanded MATH 33LA, fetched Plamen Koev's real ratings, measured
  `display: flex` and `gap: 2px 12px`, checked the Radar Mono hour labels, radar
  mark, compact accessible heading, and opened a section preview without saving.
- Account: searched and selected Computer Engineering with the existing picker
  and applied isolated guest settings successfully.
- Overview/Roadmap: searched and selected the read-only Computer Engineering
  What-if preview with Enter, inspected the rendered pages and 48 graph nodes,
  and verified the selected semester exposes its completion meter and count.
- Planner: inspected the desktop page; `/` opened Courses, Tab opened the shared
  assistant, and Escape closed it. A synthetic wheel event on the rendered
  subject strip moved scrollLeft from 0 to 86, with nowrap and scroll containment.
- Impeccable source detector: 31 style warnings/advisories, no error-severity
  findings. These concern existing fonts, accent borders, grid and motion styles;
  the approved local visual direction is retained.
- `npm run test:routes` could not start because its existing script imports
  Playwright, which is not installed. No dependency was added. The browser checks
  above used the Orca browser directly instead.

### Limits and delivery

Authenticated transcript/network-error flows and mouse dragging of subject chips
were not exercised in the browser. Mobile is outside the requested desktop target.
No production deployment is claimed before this PR is merged and Vercel finishes.

Only the differing UI files and this report belong in the commit. Temporary
archives, validation config, generated build output, dependency junctions,
screenshots, test artifacts, and unrelated local backend/eval work stay untracked
or ignored outside the commit.
