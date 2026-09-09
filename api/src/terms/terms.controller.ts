import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("terms")
export class TermsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  terms() {
    return this.prisma.term.findMany({ orderBy: { label: "desc" } });
  }
}
