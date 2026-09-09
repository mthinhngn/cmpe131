# Course Radar

Course Radar is an SJSU course-planning MVP. The React app keeps a versioned student plan in the browser. The NestJS API exposes catalog, roadmap, term, section, and stateless validation endpoints backed by PostgreSQL through Prisma.

## Run the frontend

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run PostgreSQL and the API

```powershell
docker compose up -d postgres
Copy-Item api/.env.example api/.env
Set-Location api
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

The API listens on `http://localhost:3001/api/v1`. Try `/health`, `/programs`, `/programs/software-engineering/roadmap`, `/terms`, and `/courses/cmpe131/sections?termId=fall-2026`.

`StudentPlan` is intentionally absent from the Prisma schema. The browser owns it today, including JSON export/import. `POST /api/v1/plans/validate` is stateless so the same validation boundary can later be called after authentication is added.

The repository currently includes a deliberately small week-one fixture. Every visible enrollment detail remains a planning aid and must be confirmed against the linked SJSU source.
