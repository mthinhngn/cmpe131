import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { CatalogModule } from "./catalog/catalog.module";
import { CoursesModule } from "./courses/courses.module";
import { BootstrapController } from "./bootstrap.controller";
import { AgentModule } from "./agent/agent.module";

@Module({
  imports: [PrismaModule, CatalogModule, CoursesModule, AgentModule],
  controllers: [HealthController, BootstrapController],
})
export class AppModule {}
