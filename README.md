# Course Radar

Course Radar supports SJSU Computer Engineering and Software Engineering, catalog 2026-2027 only. Its academic workspace brings together a personal overview, course explorer, degree roadmap, prerequisite chart, session-based semester planner, manual schedule builder, and a Gemini-powered scheduling assistant.

## Current scope

- Computer Engineering and Software Engineering, selected on the main page.
- 2026-2027 roadmap and course details.
- Fall 2026 sections, meeting times, modes, locations, dates, and open-seat counts, including rows with zero open seats.
- Prerequisite relationships stored in PostgreSQL through Prisma.
- NestJS read API.
- Instructor names and Rate My Professors search links (not verified profile matches).
- A session-only eight-semester course planner that resets on refresh.
- A separate Fall 2026 schedule builder in Course Explorer: manually select sections, view an hourly weekly calendar, and see overlapping-time warnings. Schedule selections persist in browser `localStorage`; there is no authentication, cross-device sync, or registration action.
- A read-only Gemini scheduling agent that can build from the official roadmap even when the semester planner is empty. It derives prerequisite eligibility from completed courses, preserves every currently selected section as a hard lock, excludes closed new sections, backtracks to another eligible graduation-progress course when needed, and returns proposals that require explicit confirmation.

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

Open `http://localhost:5173`. The frontend calls the backend at `http://localhost:3001/api/v1` by default. If the API is unavailable, catalog screens fall back to the reviewed 2026-2027 dataset bundled with the frontend; the Gemini scheduling agent still requires the backend and PostgreSQL.

- Overview: `http://localhost:5173/`
- Course explorer: `http://localhost:5173/courses`
- Roadmap: `http://localhost:5173/roadmap`
- Vertical prerequisite chart: `http://localhost:5173/prerequisite-chart`
- Semester planner: `http://localhost:5173/planner`
- Scheduling assistant: `http://localhost:5173/recommendations`

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

The manual schedule builder consumes the same offering records returned by `/api/v1/bootstrap` (or the generated fixture when the API is unavailable). The scheduling agent is stricter: its tools require PostgreSQL and will return `CATALOG_UNAVAILABLE` instead of silently treating frontend fixtures as authoritative.

## Gemini free-tier setup

The backend uses `@google/genai` Interactions API with `store: false`. The API key is never sent to Vite or stored in browser state.

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey) using a project that remains on the Gemini Free tier without Cloud Billing.
2. Before starting Docker Compose, set the key in the terminal that will run Compose. Do not add it to a `VITE_` variable or commit it:

```powershell
$env:GEMINI_API_KEY="your-key-here"
docker compose up --build -d
```

The key is optional for catalog, roadmap, planner, and manual schedule features. It is required only for the Gemini scheduling assistant. To run the backend directly outside Docker, copy `api/.env.example` to `api/.env`, then use the manual backend commands below.

```powershell
Copy-Item api\.env.example api\.env
docker compose up -d postgres
npm --prefix api install
npm --prefix api run prisma:migrate
npm --prefix api run prisma:seed
npm --prefix api run dev
```

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`. `AGENT_MAX_TOOL_CALLS` may lower, but cannot raise, the hard six-call safety limit. `AGENT_MAX_COMBINATIONS` bounds deterministic schedule search.

Free-tier capacity and rate limits are not guaranteed. A missing/invalid key, exhausted quota, network failure, or unavailable PostgreSQL catalog produces a recoverable assistant message and never disables the manual planner or schedule builder. Google states that free-tier content may be used to improve its products, so this course demo should use sample or self-reported planning data—not protected student records. See the official [Interactions API documentation](https://ai.google.dev/gemini-api/docs/interactions-overview), [function-calling guide](https://ai.google.dev/gemini-api/docs/function-calling), and [pricing/free-tier table](https://ai.google.dev/gemini-api/docs/pricing).

## API

- `GET /api/v1/programs`
- `GET /api/v1/programs/:slug/requirements?catalogYear=2026-2027`
- `GET /api/v1/courses/:id?catalogYear=2026-2027&program=software-engineering`
- `GET /api/v1/bootstrap?program=software-engineering` (defaults to `computer-engineering`)
- `GET /api/v1/health`
- `POST /api/v1/agent/messages`

The agent endpoint accepts at most eight prior conversation turns plus the optional session plan, completed course IDs, selected class numbers, and structured unavailable times. A simple “Build my schedule” request invokes `build_autonomous_schedule`, which reads the roadmap and prerequisite graph, targets 12–15 units, searches only open new sections, and returns the best verified partial schedule when the full load is impossible. Existing selected sections are hard locks. It returns assistant text, sanitized tool activity, a decision trace, warnings, and up to three proposals. Tool calls are read-only; there is no arbitrary SQL tool and no API endpoint that mutates a student schedule.

The Recommendations screen shows the current locked weekly schedule above the conversation. Chat state survives navigation between Course Radar routes, but remains React-memory-only and clears on a browser refresh. Applying a proposal still requires a second explicit confirmation, and the browser validates that no hard lock was removed.

Software Engineering data lives in `src/softwareEngineeringData.ts`, based on the [official SE roadmap](https://catalog.sjsu.edu/preview_program.php?catoid=23&poid=19349&returnto=8647). Two math/statistics pairs are explicitly marked choose-one; open-ended electives remain placeholders. Shared course IDs retain separate program-specific course versions in Prisma. Docker Compose imports both programs automatically through the idempotent seed step; direct backend setups must run `npm --prefix api run prisma:seed` explicitly.
