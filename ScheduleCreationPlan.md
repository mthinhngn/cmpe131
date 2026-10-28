# Schedule Creation Feature Plan

Status: core manual V1 implemented; later improvements proposed  
Updated: 2026-09-11

## Product decision

The schedule builder is useful because it solves a different problem from the eight-semester Planner: the Planner answers *which semester should contain this course*, while the schedule builder answers *which real Fall 2026 sections fit together during the week*.

V1 is intentionally narrow:

- the student manually selects sections;
- the weekly calendar appears after the first selection;
- selected sections persist in the current browser;
- overlapping meeting times are detected and explained;
- conflicting classes remain visible so the student can compare them;
- TBA/unparseable meetings are listed as unverifiable; and
- the feature does not check prerequisites, generate an optimal schedule, register classes, or require an account.

## Implemented architecture

```text
Course Explorer / CourseDetail
        │ Add or replace section
        ▼
ScheduleContext
        ├── key: program + catalog year + term
        ├── one selection per course component
        └── localStorage: course-radar-schedules-v1
        │
        ├── src/schedule.ts
        │   ├── parse meeting day/time strings
        │   └── detect pairwise time overlap
        │
        └── WeeklySchedule
            ├── hourly calendar
            ├── full time, professor, and room
            ├── TBA/unverifiable list
            └── textual conflict summary
```

The section data comes from the existing `GET /api/v1/bootstrap` response. If the API is unavailable, `CatalogContext` supplies the matching reviewed fixture. Personal selections never go to the backend.

## Completed implementation order

1. Added the pure meeting parser and conflict detector in `src/schedule.ts`.
2. Added versioned, program/catalog/term-isolated selection state in `src/ScheduleContext.tsx`.
3. Connected Add/Added/Replace actions to offering cards in `src/App.tsx`.
4. Added the responsive weekly calendar in `src/WeeklySchedule.tsx` and Course Explorer.
5. Added conflict and parser coverage in `tests/schedule.test.mjs`.
6. Verified frontend typecheck, automated domain tests, and production build.

## Recommended next iterations

### 1. Normalize meeting data at import time

Move day/time parsing from React into the Fall 2026 importer. Preserve original display strings for audit, but return normalized meeting patterns from the fixture and NestJS bootstrap DTO. This reduces runtime ambiguity and enables multiple meeting patterns per class.

### 2. Improve section relationships

Only add automatic lecture/lab pairing if the official source exposes a reliable relationship. Until then, keep component selection manual and explicit.

### 3. Add schedule preferences before generation

Do not add a `Generate schedule` button until the product defines ranking inputs such as earliest start, latest end, preferred days, required breaks, online/in-person preference, and closed-section policy. A generator without those inputs would produce arbitrary results.

### 4. Add safe portability

Provide validated JSON export/import and a clear-schedule action. Keep browser ownership until authentication and a privacy model justify server persistence.

### 5. Visual and accessibility acceptance

Have the user verify the final hourly alignment in the live UI. Add browser automation only when explicitly requested. Automated tests should continue to cover overlap, containment, identical times, back-to-back sections, different days, TBA, and imported composite strings.

## Definition of done for V1

V1 is complete when a student can manually select Fall 2026 sections, read every selected class's full time/professor/room, see those meetings on an hourly weekly calendar, identify overlapping classes through both styling and text, replace a conflicting section, and retain the result after refresh in the same browser.

Official SJSU catalog and registration systems remain authoritative.
