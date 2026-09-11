# Course Radar

Course Radar supports SJSU Computer Engineering and Software Engineering, catalog 2026-2027 only. Its academic workspace brings together a personal overview, course explorer, degree roadmap, prerequisite chart, session-based semester planner, and a clearly labeled preview of future recommendations.

## Current scope

- Computer Engineering and Software Engineering, selected on the main page.
- 2026-2027 roadmap and course details.
- Fall 2026 sections, meeting times, modes, locations, dates, and open-seat counts, including rows with zero open seats.
- Prerequisite relationships stored in PostgreSQL through Prisma.
- NestJS read API.
- Instructor names and Rate My Professors search links (not verified profile matches).
- A frontend-only semester planning draft that resets on refresh; no persistent student plan, authentication, ratings import, or schedule-conflict checking yet.

## Run the frontend

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Without the API, the UI uses the reviewed 2026-2027 catalog dataset bundled with the frontend.

- Overview: `http://localhost:5173/`
- Course explorer: `http://localhost:5173/courses`
- Roadmap: `http://localhost:5173/roadmap`
- Vertical prerequisite chart: `http://localhost:5173/prerequisite-chart`
- Semester planner: `http://localhost:5173/planner`
- Recommendations preview: `http://localhost:5173/recommendations`

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

## API

- `GET /api/v1/programs`
- `GET /api/v1/programs/:slug/requirements?catalogYear=2026-2027`
- `GET /api/v1/courses/:id?catalogYear=2026-2027&program=software-engineering`
- `GET /api/v1/bootstrap?program=software-engineering` (defaults to `computer-engineering`)
- `GET /api/v1/health`

Database setup and final verification are deferred until the project reaches the integration phase.

Software Engineering data lives in `src/softwareEngineeringData.ts`, based on the [official SE roadmap](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647). Two math/statistics pairs are explicitly marked choose-one; open-ended electives remain placeholders. Shared course IDs retain separate program-specific course versions in Prisma. Run the existing seed after database setup to import both programs; this update does not run migrations or seed automatically.
