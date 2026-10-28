import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { BootstrapController } from "./bootstrap.controller";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, BootstrapController],
})
export class AppModule {}
