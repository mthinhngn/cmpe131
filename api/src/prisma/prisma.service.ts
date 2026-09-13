import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      this.logger.warn("PostgreSQL is unavailable at startup; catalog requests will fail safely until it recovers.");
    }
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
