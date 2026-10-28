# Course Radar

Course Radar supports SJSU Computer Engineering and Software Engineering, catalog 2026-2027 only. Its academic workspace brings together a personal overview, course explorer, degree roadmap, prerequisite chart, session-based semester planner, and manual schedule builder.

## Current scope

- Computer Engineering and Software Engineering, selected on the main page.
- 2026-2027 roadmap and course details.
- Fall 2026 sections, meeting times, modes, locations, dates, and open-seat counts, including rows with zero open seats.
- Prerequisite relationships stored in PostgreSQL through Prisma.
- NestJS read API.
- Instructor names and Rate My Professors search links (not verified profile matches).
- A session-only eight-semester course planner that resets on refresh.
- A separate Fall 2026 schedule builder in Course Explorer: manually select sections, view an hourly weekly calendar, and see overlapping-time warnings. Schedule selections persist in browser `localStorage`; there is no authentication, cross-device sync, or registration action.

## Run the project after cloning

Prerequisites: Node.js 24+, npm, and Docker Desktop with the Linux container engine running.

Install the frontend dependencies:

```powershell
npm install
```

Start PostgreSQL and the NestJS backend. Docker Compose builds the API image, waits for PostgreSQL, applies committed Prisma migrations, seeds both program catalogs and Fall 2026 sections, and then starts the API:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:3001/api/v1/health
```

Start the frontend in a separate terminal:

```powershell
npm run dev
```

Open `http://localhost:5173`. All frontend entries use `/api/v1`; Vite proxies `/api` to `http://localhost:3001` during development and preview. Overview and the full prerequisite map consume the same bootstrap catalog as the planner, course explorer, and roadmap. The Home preview remains illustrative. If the API is unavailable, catalog screens fall back to the reviewed 2026-2027 dataset bundled with the frontend.

- Home: `http://localhost:5173/`
- Overview: `http://localhost:5173/overview`
- Course explorer: `http://localhost:5173/courses`
- Roadmap: `http://localhost:5173/roadmap`
- Prerequisite map: `http://localhost:5173/prerequisites` (`/prerequisite-chart` is an alias)
- Catalog prerequisite workspace: `http://localhost:5173/catalog-prerequisites`
- Semester planner: `http://localhost:5173/planner`

Useful backend commands:

```powershell
docker compose logs -f api
docker compose restart api
docker compose down
```

`docker compose down` preserves PostgreSQL data in the named volume. To deliberately reset the local database, run `docker compose down -v`, then start the stack again. This deletes the local Course Radar database volume.

## Backend data flow

```text
Official SJSU 2026-2027 catalog -> structured catalog data -> Prisma seed/import -> PostgreSQL -> NestJS API -> React
```

The reviewed structured dataset is in `src/data.ts`. It is imported by the seed script; nobody needs to type individual SQL rows manually. The source of truth for this version is the [official 2026-2027 Computer Engineering roadmap](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19250&returnto=8647), with each linked course page used to check prerequisite wording.

Fall 2026 offerings are generated from the [official SJSU Fall 2026 class schedule](https://www.sjsu.edu/classes/schedules/fall-2026.php):

```powershell
npm run data:fall-2026
```

The importer keeps lecture/lab components, rows with `0` open seats, and instructor names. Clicking a section reveals SJSU-scoped Rate My Professors name-search links.

The manual schedule builder consumes the same offering records returned by `/api/v1/bootstrap` (or the generated fixture when the API is unavailable).

## API

- `GET /api/v1/bootstrap?program=software-engineering` (defaults to `computer-engineering`)
- `GET /api/v1/health`


Software Engineering data lives in `src/softwareEngineeringData.ts`, based on the [official SE roadmap](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647). Two math/statistics pairs are explicitly marked choose-one; open-ended electives remain placeholders. Shared course IDs retain separate program-specific course versions in Prisma. Docker Compose imports both programs automatically through the idempotent seed step; direct backend setups must run `npm --prefix api run prisma:seed` explicitly.

## API deployment configuration

For a frontend hosted separately from NestJS, set `VITE_API_URL` to the deployed HTTPS API base, including `/api/v1`, before building. Set backend `WEB_ORIGIN` to that frontend's exact origin. `.env.example` documents the frontend variable. The Vercel project remains a frontend-only deployment: its SPA rewrite does not host PostgreSQL or NestJS. Without a deployed API URL, a static deployment uses the reviewed catalog snapshot.

The active API surface is `GET /api/v1/health` and `GET /api/v1/bootstrap?program=computer-engineering|software-engineering`. Bootstrap carries course details, recorded prerequisites/corequisites, requirement choices, term information and section snapshots. The unused standalone program/requirements/course-detail endpoint modules have been removed. Database migrations and catalog provenance remain intact; this cleanup does not drop existing database data.

Overview reports listed core-course progress rather than claiming a complete degree audit. Placeholder requirements are retained in the roadmap and are not counted as completed courses. Completed courses and the selected program are personal drafts kept in sessionStorage for the current tab across document navigation and refresh. Semester plans remain React-memory drafts and reset on document navigation/refresh. No account or server-side personal-plan persistence is introduced.

Recommendations and its scheduling-agent backend have been removed. The legacy `/recommendations` URL redirects to `/courses`. Catalog/bootstrap, health, manual scheduling and planner persistence remain available.
