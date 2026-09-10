# Computer Engineering backend snapshot

## Implemented now

- The product is limited to SJSU Computer Engineering.
- The frontend lists five graduation requirement groups and opens course prerequisite details.
- The dataset is explicitly labeled `draft-unverified`.
- Prisma models catalog versions, courses, course versions, prerequisite rules, requirement groups, requirement items, and source snapshots.
- NestJS exposes read-only program, requirement, course, bootstrap, and health endpoints.
- The seed imports structured data; it does not contain hand-written SQL inserts.

## Removed from this phase

- Student plans and browser local storage.
- Authentication and user IDs.
- Terms, sections, instructors, seat availability, and meeting conflicts.
- Planning and plan-validation endpoints.
- Software Engineering data.

## Data caveat

The current draft is based on the existing Fall 2024 BSCMPE prerequisite-chart reference. Live SJSU access failed during this implementation pass, so the dataset has not been promoted to `reviewed`. The next data task is to compare this draft against the official catalog and update `lastVerifiedAt` only after that review succeeds.

## Next backend implementation

Build one importer command that accepts reviewed Computer Engineering catalog data, validates duplicate IDs and missing prerequisite references, and publishes a catalog version in one transaction. PostgreSQL then becomes the runtime source of truth for the React application.
