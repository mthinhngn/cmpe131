# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SJSU students planning degree progress and term schedules. The user confirmed this audience and primary job on 2026-10-25.

## Product Purpose

Course Radar helps students inspect a degree roadmap, understand recorded course prerequisites, explore catalog courses, track a personal course plan, and compare listed sections for a term. Success means students can make a clearer personal plan while keeping official SJSU requirements and enrollment information as the authority.

## Positioning

Open: no comparative or unique-market claim has been confirmed.

## Operating Context

The current web app offers Computer Engineering and Software Engineering degree views against the 2026-2027 catalog, plus Fall 2026 section information. Students can mark courses as completed, organize courses into personal semester slots, inspect recorded prerequisite and corequisite relationships, and select listed sections into a weekly schedule.

## Capabilities and Constraints

- Roadmap and course records include official source links, units, recommended semesters, and recorded prerequisite details.
- Course completion is a personal draft remembered in the current browser tab session across navigation and refresh, together with the selected program. Semester plans remain React-memory drafts and reset on refresh. Neither is an official degree audit or an authenticated student record.
- Listed sections and seat availability are a dated snapshot, not live enrollment. The interface distinguishes database data from its reviewed local snapshot.
- Personal plans are planning aids. Students must verify requirements, grades, course availability, and enrollment details against official SJSU sources.
- The available program views are Computer Engineering — BS and Software Engineering — BS.

## Brand Commitments

The product name is Course Radar. No additional confirmed verbal identity or competitive claim is recorded.

## Evidence on Hand

The repository contains reviewed course, roadmap, prerequisite, and Fall 2026 offering data in `src/data.ts` and `src/fall2026Offerings.generated.ts`, with source URLs attached to records. Do not invent student outcomes, partner logos, testimonials, enrollment guarantees, or graduation metrics.

## Product Principles

- Keep official catalog information and source links easy to find.
- Make planning state visibly personal and provisional.
- Preserve recorded course relationships and section details when presenting options.
- Make the limits of snapshots and incomplete degree-audit coverage clear.

## Landing Experience

The landing route introduces the product through a selected, interactive portion of the prerequisite graph. Students can switch between the two available programs, inspect recorded course conditions, add a course to their session plan, search the program catalog, and continue to the full workspace. The page demonstrates the planning process while clearly labeling illustrative schedule content. Its first job is to make course relationships useful, not to promise graduation outcomes.
