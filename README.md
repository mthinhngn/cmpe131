# Course Radar

Course Radar helps SJSU students explore catalog courses, track completed courses, plan semesters, and choose sections for a weekly schedule. Plans are personal planning aids; official SJSU requirements and enrollment information remain authoritative.

Live site: https://cmpe131.vercel.app

## Scope

| Page | URL | What it does |
| --- | --- | --- |
| Home | `/` | Product introduction with an animated preview |
| Overview | `/overview` | Program progress at a glance |
| Schedule | `/schedule` | Browse sections and build a weekly calendar |
| Planner | `/planner` | Place courses into semesters |
| Roadmap | `/roadmap` | Prerequisite map and requirement choices |
| Account | `/account` | Profile, program preferences, and sign-in |

- Covers SJSU catalog and program data, with dated section snapshots (not live seat availability).
- Guest mode works without an account; guest and account workspaces are kept separate.
- One in-app assistant (`ChatWidget`) can answer questions and make planner changes.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, plain CSS, React Flow |
| Backend API | NestJS, Prisma |
| Databases | PostgreSQL 17: one for catalog and guest data, one for accounts |
| Assistant | Python, FastAPI, LangGraph, Groq (model), Tavily (web search) |
| Local infrastructure | Docker Compose (databases) |
| Hosting | Vercel |

## Run it locally

### 1. Requirements

- Node.js 24+
- Docker Desktop (running)
- Python 3.11+ (only for the assistant)

### 2. Install

From the project root:

```powershell
npm install
npm --prefix api install
python -m pip install -r agent_service/requirements.txt   # optional, assistant only
```

### 3. Environment files

```powershell
Copy-Item .env.example .env
Copy-Item api/.env.example api/.env
```

In `api/.env`, set the database URLs to match the Docker containers:

```
DATABASE_URL="postgresql://course_radar:course_radar@localhost:5432/course_radar?schema=public"
USER_DATABASE_URL="postgresql://course_radar_users:course_radar_users@localhost:5433/course_radar_users?schema=public"
```

For the assistant, set `GROQ_API_KEY` and `TAVILY_API_KEY` in the root `.env`. Never commit `.env` files or put secrets in `VITE_` variables.

### 4. Database (first time only)

```powershell
docker compose up -d --wait postgres users-postgres
cd api
npm run clients:generate
npx prisma migrate deploy
npm run users:migrate
npm run prisma:seed
cd ..
```

This starts both databases, creates the tables, and loads the SJSU catalog data. You don't need to repeat it on later runs.

### 5. Start the app

One command starts everything (databases, API, assistant, frontend):

```powershell
npm run dev:all
```

Open **http://localhost:5175**. Press Ctrl+C to stop.

Or run each part in its own terminal:

| Part | Command | Port |
| --- | --- | --- |
| Databases | `docker compose up -d postgres users-postgres` | 5432, 5433 |
| Backend API | `npm --prefix api run dev` | 3004 |
| Assistant (optional) | `npm run agent:dev` | 8000 |
| Frontend | `npm run dev -- --port 5175 --strictPort` | 5175 |

The frontend needs the backend API running; the assistant is optional.

## Tests

```powershell
npm test                  # frontend logic
npm run build             # type check and production build
npm --prefix api test     # backend
npm run agent:test        # assistant
```

## Troubleshooting

- **Port already in use:** another copy of the service is running. Stop it, or reuse it.
- **Database connection error:** make sure Docker Desktop is running and the URLs in `api/.env` match step 3.
- **Page shows HTML instead of data (`Unexpected token '<'`):** the API isn't reachable. Start it with `npm run dev:all`.

## More documentation

- [PRODUCT.md](PRODUCT.md): product behavior and constraints
- [DESIGN.md](DESIGN.md): visual design system
