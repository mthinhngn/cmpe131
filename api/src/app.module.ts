import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { CatalogModule } from "./catalog/catalog.module";
import { CoursesModule } from "./courses/courses.module";
import { TermsModule } from "./terms/terms.module";
import { PlanningModule } from "./planning/planning.module";

@Module({
  imports: [PrismaModule, CatalogModule, CoursesModule, TermsModule, PlanningModule],
  controllers: [HealthController],
})
export class AppModule {}
