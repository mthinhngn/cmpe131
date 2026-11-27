import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

type FeedbackBody = { courseCode?: unknown; rating?: unknown; comment?: unknown };

const cleanCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, " ");

@Controller("feedback")
export class FeedbackController {
  constructor(private readonly db: PrismaService) {}

  @Get(":courseCode")
  async list(@Param("courseCode") courseCode: string) {
    const code = cleanCode(courseCode);
    const items = await this.db.courseFeedback.findMany({
      where: { courseCode: code },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const average = items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : null;
    return { courseCode: code, count: items.length, average, items };
  }

  @Post()
  async create(@Body() body: FeedbackBody) {
    const courseCode = cleanCode(typeof body.courseCode === "string" ? body.courseCode : "");
    const comment = (typeof body.comment === "string" ? body.comment : "").trim();
    const rating = Number(body.rating);
    if (!courseCode || courseCode.length > 20) throw new BadRequestException("A valid course code is required.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException("Rating must be a whole number from 1 to 5.");
    if (comment.length < 3 || comment.length > 500) throw new BadRequestException("Comment must be 3 to 500 characters.");
    return this.db.courseFeedback.create({ data: { courseCode, rating, comment } });
  }
}