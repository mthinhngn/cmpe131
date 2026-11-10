import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import type { Course, CourseOffering } from "./course-types";
import { courseDependencies } from "./course-dependencies";
import type { CalendarData } from "./schedule-sync";

export async function universityCalendar(db: PrismaService): Promise<CalendarData | null> {
  const row = await db.sharedAcademicCalendar.findUnique({ where: { id: "sjsu-regular-calendar-v1" } });
  const value = row?.evidence as unknown as CalendarData | undefined;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  return value?.status === "verified" && value.as_of <= today && today <= value.valid_until ? value : null;
}

export async function universityCourses(db: PrismaService): Promise<Course[]> {
  const rows = await db.$queryRaw<Array<{ id: string; code: string; title: string; units: number | null; unitsText: string; description: string | null; prerequisiteText: string | null; corequisiteText?: string | null; prerequisiteCodes?: string[]; corequisiteCodes?: string[]; sourceUrl: string }>>`
    SELECT c.id,c.code,r.title,r.units,r."unitsText",r.description,r."prerequisiteText",r."corequisiteText",r."prerequisiteCodes",r."corequisiteCodes",r."sourceUrl"
    FROM "UniversityCourseRecord" r JOIN "Course" c ON c.id=r."courseId" WHERE r."catalogYear"='2026-2027' ORDER BY c.code`;
  const ids = new Map(rows.map(r => [r.code, r.id]));
  return rows.map(r => {
    const prerequisites = courseDependencies(r.prerequisiteText, (r.prerequisiteCodes ?? []).filter(code => code !== r.code), ids);
    const corequisites = courseDependencies(r.corequisiteText, (r.corequisiteCodes ?? []).filter(code => code !== r.code), ids);
    return { ...r, units: r.units ?? 0, description: r.description ?? "Catalog description and prerequisites have not yet been retrieved. Verify requirements with SJSU.", prerequisiteText: [r.prerequisiteText ?? "Prerequisites not yet retrieved; verify with SJSU.", r.corequisiteText ? `Corequisites: ${r.corequisiteText}` : ""].filter(Boolean).join(" "), recommendedSemester: 0,
      prerequisiteCourseIds: prerequisites.required, prerequisiteOptionCourseIds: prerequisites.conditional,
      corequisiteCourseIds: corequisites.required, corequisiteOptionCourseIds: corequisites.conditional };
  });
}

export async function universitySections(db: PrismaService, term: string) {
  if (!/^(fall|winter|spring|summer)-(19|20|21)\d{2}$/.test(term)) throw new BadRequestException("Invalid semester.");
  const rows = await db.$queryRaw<Array<{ evidence: Record<string, any>; fetchedAt: Date }>>`
    SELECT evidence,"fetchedAt" FROM "UniversitySectionRecord" WHERE "termId"=${term} ORDER BY "classNumber"`;
  const offerings: CourseOffering[] = rows.map(({ evidence: r }) => ({
    courseCode: r.courseCode, classNumber: r.classNumber, sectionNumber: r.sectionNumber,
    component: r.component || "Unlisted", mode: r.mode, days: r.days, times: r.times,
    location: r.location, dates: r.dates, instructors: r.instructors,
    openSeats: r.openSeats ?? 0, seatsKnown: r.openSeats !== null,
    scheduleReview: !r.component || /\bcancel(?:led|ed)\b/i.test(r.notes || ""), notes: [r.mandatoryZoom, r.notes].filter(Boolean).join(" · "),
  }));
  return { term, status: rows.length ? "available" : "unavailable", offerings,
    sourceUrl: `https://www.sjsu.edu/classes/schedules/${term}.php`, fetchedAt: rows[0]?.fetchedAt.toISOString(),
    message: rows.length ? "Imported SJSU snapshot; catalog enrichment remains incomplete." : "No imported sections for this semester." };
}

@Controller("university")
export class UniversityController {
  constructor(private readonly db: PrismaService) {}
  @Get("terms") async terms() { return await universityCalendar(this.db) ?? { status: "unavailable", current_term: null, message: "Academic calendar needs a new verified snapshot." }; }
  @Get("sections") sections(@Query("term") term = "fall-2026") { return universitySections(this.db, term); }
}
