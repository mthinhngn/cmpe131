# Course Radar

Course Radar currently focuses on one program: SJSU Computer Engineering. It displays graduation requirement groups, courses, and recorded prerequisite relationships for a selected catalog dataset.

## Current scope

- Computer Engineering only.
- Graduation requirements and course details.
- Prerequisite relationships stored in PostgreSQL through Prisma.
- NestJS read API.
- No student plan, local storage, authentication, class sections, availability, or schedule conflicts.

## Run the frontend

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Without the API, the UI uses the same draft catalog fixture and labels it `Local draft`.

## Backend data flow

```text
Reviewed SJSU source -> structured catalog data -> Prisma seed/import -> PostgreSQL -> NestJS API -> React
```

The current structured draft is in `src/data.ts`. It is imported by the seed script; nobody needs to type individual SQL rows manually. Before the dataset is marked reviewed, its course list, graduation groups, and prerequisite wording must be checked against the official SJSU catalog.

## API

- `GET /api/v1/programs`
- `GET /api/v1/programs/computer-engineering/requirements?catalogYear=...`
- `GET /api/v1/courses/:id?catalogYear=...`
- `GET /api/v1/bootstrap`
- `GET /api/v1/health`

Database setup and final verification are deferred until the project reaches the integration phase.
