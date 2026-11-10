# Production hosting

The public app is `https://cmpe131.vercel.app`. Vercel builds the existing Vite screens and runs the NestJS API as a container service. `/api/*` routes to the API before the frontend catch-all. Local Vite proxies are only for development.

Two Neon PostgreSQL resources belong to the same Vercel project:

- `course-radar-production`: public program, course, section and requirement snapshots (`DATABASE_URL`).
- `course-radar-accounts`: accounts, sessions, saved plans and operation receipts (`USER_DATABASE_URL`).

Neither service depends on a developer computer being online. Production credentials are Vercel environment variables, never source files. Apply catalog and account Prisma migrations separately; never reset the production databases. The initial catalog import excludes local accounts, personal workspaces and operation receipts.

Manual Schedule actions read verified calendar evidence through `/api/v1/university/terms` and sections through `/api/v1/university/sections`. They do not require the assistant service. Expired calendar evidence fails closed until a new verified snapshot is imported.

## Guest and account behavior

Guest drafts live temporarily in `sessionStorage` under `course-radar-guest-tab-v1`, so navigation and reload work within a tab. Guest API operations validate against the hosted catalog and return the updated draft without writing a personal database record. Closing the tab discards the draft, subject to browser session restoration. Guests do not initialize account plans.

Signed-in users use the existing authenticated workspace transactions, conflict checks, receipts, retry and Undo. Account saves are acknowledged only after PostgreSQL accepts them.

## Sign-in email

Production requires `AUTH_DELIVERY=resend`, `AUTH_WEB_ORIGIN=https://cmpe131.vercel.app`, `WEB_ORIGIN=https://cmpe131.vercel.app` and `RESEND_API_KEY`.

`AUTH_TEST_EMAIL` currently restricts delivery to the owner's test inbox. To support other users' email addresses, verify a sending domain in Resend, configure `AUTH_EMAIL_FROM` as `Course Radar <login@your-verified-domain>` and remove `AUTH_TEST_EMAIL`. App users do not need hosting accounts or infrastructure approvals.

## Release verification

Build the frontend and API and run their tests. Deploy with `vercel deploy --prod --skip-domain --yes`, verify the deployment's API and database-backed saves, then promote it with `vercel promote <deployment-url>`. The compiled API container includes its own dependencies and Prisma engines; it avoids dependency tracing failures in the current NestJS Services builder.

The Python Course Action/Web Search assistant is a separate service. Its in-memory request queue needs suitable hosting before production chat can be considered operational; deploying the frontend and account API does not deploy that service automatically.
