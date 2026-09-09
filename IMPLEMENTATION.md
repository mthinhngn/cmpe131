# Course Radar - current implementation snapshot

This is the first-week MVP slice. The browser workflow is the priority now; Docker, database acceptance checks, and end-to-end verification are intentionally deferred to the final phase.

## What is working in the website

- Course Explorer for Software Engineering and Computer Engineering.
- Roadmap view with catalog-specific course sequence and prerequisite highlighting.
- Course detail drawer with units, prerequisites, sections, meeting times, instructors, source links, and section selection.
- `My Plan` page at `/plan`.
- Completed-course state stored in the browser.
- One selected section per course.
- Prerequisite warnings with missing course IDs translated to course codes.
- Meeting-time conflict warnings for overlapping days and intervals.
- JSON export/import for browser plans.
- Invalid JSON import leaves the existing plan unchanged and shows an inline error.
- Responsive mobile layout and keyboard-visible controls.

The stored plan is versioned JSON. It contains `schemaVersion`, `major`, `catalog`, `dataVersion`, completed course IDs, selected section IDs, and `updatedAt`. No account or authentication is required.

## Architecture prepared for the next phase

- `api/` contains the NestJS modular monolith.
- `api/prisma/schema.prisma` models programs, catalog versions, courses, prerequisite rules, roadmap items, terms, sections, meetings, instructors, and source snapshots.
- `api/src/catalog`, `api/src/courses`, `api/src/terms`, and `api/src/planning` are separated by responsibility.
- `GET /api/v1/bootstrap` is the read model used by the frontend when the API is available.
- `POST /api/v1/plans/validate` is stateless. It validates a plan without persisting it, leaving room for authenticated persistence later.
- `src/planner.ts` and `api/src/planning/rules.ts` keep the planning rules independent from React and NestJS controllers.

## Run the current website

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. When the API is not running, the website uses its local fixture data and labels it as a sample dataset. Docker and PostgreSQL are not required for this phase.

## Deliberately deferred

- User IDs, authentication, and server-side plan persistence.
- Production data import and catalog-source review.
- Real-time seat availability or enrollment integration.
- Final Docker/database acceptance testing and complete end-to-end test pass.
