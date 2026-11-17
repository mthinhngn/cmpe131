# SJSU schedule refresh

## Scheduled refresh

```powershell
npm run data:sjsu -- --schedules-only --write-db --output "$env:TEMP/sjsu-refresh"
```

This mode fetches the three main schedules and preserves existing catalog details. An unchanged page hash advances only the term’s check time. A changed page saves its SJSU update date and listed sections together. Missing main-schedule sections remain in saved schedules with a delisted flag. Separate iSchool-only rows retain their own source coverage. A term with at least 100 previously listed main-schedule sections must retain at least 70% of those rows by count before the importer will save it.

The importer exits `0` when all three terms are written or unchanged (`verified` in a dry run). It exits `3` if any term fails to fetch, verify, or save. A missing SJSU date is a report issue and the term can still refresh. Each term commits independently. Raw pages and `report.json` go to `--output` or, for an online run with no output path, a temporary directory.

The GitHub Actions workflow runs hourly at minute 17 and supports manual dispatch. It uploads the report even when the refresh fails. Before enabling it, apply the Prisma migration, configure the repository’s `DATABASE_URL` secret, and confirm PostgreSQL accepts connections from GitHub-hosted runners. GitHub sends scheduled failure emails to the workflow’s schedule actor when that account enables Actions email notifications.
