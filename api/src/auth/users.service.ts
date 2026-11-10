import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../generated/users";

@Injectable()
export class UsersService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() { super({ transactionOptions: { maxWait: 10000, timeout: 15000 } }); }
  async onModuleInit() {
    try { await this.$connect(); }
    catch { new Logger(UsersService.name).warn("User PostgreSQL database unavailable; account requests will fail until it recovers."); }
  }
  async onModuleDestroy() { await this.$disconnect(); }
}
