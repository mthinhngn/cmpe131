import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type ValidatePlanInput = {
  catalogYear?: string;
  courseIds: string[];
  completedCourseIds: string[];
  selectedSectionIds: string[];
};

function toMinutes(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: ValidatePlanInput) {
    const [versions, sections] = await Promise.all([
      this.prisma.courseVersion.findMany({
        where: { courseId: { in: input.courseIds }, catalogVersion: input.catalogYear ? { catalogYear: input.catalogYear } : undefined },
        include: { prerequisiteRules: true },
      }),
      this.prisma.section.findMany({ where: { id: { in: input.selectedSectionIds } }, include: { meetings: true } }),
    ]);
    const completed = new Set(input.completedCourseIds);
    const eligibility = versions.map((version) => {
      const missingCourseIds = version.prerequisiteRules.filter((rule) => !rule.isCorequisite && !completed.has(rule.requiredCourseId)).map((rule) => rule.requiredCourseId);
      return { courseId: version.courseId, status: missingCourseIds.length ? "unmet" : "met", missingCourseIds };
    });
    const conflicts: Array<{ firstSectionId: string; secondSectionId: string; day: string }> = [];
    for (let left = 0; left < sections.length; left += 1) for (let right = left + 1; right < sections.length; right += 1) {
      for (const first of sections[left].meetings) for (const second of sections[right].meetings) {
        const firstStart = toMinutes(first.startTime); const firstEnd = toMinutes(first.endTime);
        const secondStart = toMinutes(second.startTime); const secondEnd = toMinutes(second.endTime);
        if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) continue;
        for (const day of first.days.filter((value) => second.days.includes(value))) {
          if (firstStart! < secondEnd! && secondStart! < firstEnd!) conflicts.push({ firstSectionId: sections[left].id, secondSectionId: sections[right].id, day });
        }
      }
    }
    return { eligibility, conflicts, valid: eligibility.every((item) => item.status === "met") && conflicts.length === 0 };
  }
}
