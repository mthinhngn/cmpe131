import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { UsersService } from "./auth/users.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService) {}

  @Get()
  async health() {
    await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.users.$queryRaw`SELECT 1`]);
    return { status: "ok", database: "connected", userDatabase: "connected", checkedAt: new Date().toISOString() };
  }
}
