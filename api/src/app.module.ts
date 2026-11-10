import { AuthService } from "./auth/auth.service";
import { AuthController, AuthOriginGuard } from "./auth/auth.controller";
import { UsersService } from "./auth/users.service";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceController } from "./workspace.controller";
import { UniversityController } from "./university.controller";
import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health.controller";
import { BootstrapController } from "./bootstrap.controller";

@Module({
  imports: [PrismaModule],
  providers: [WorkspaceService, UsersService, AuthService, AuthOriginGuard],
  controllers: [UniversityController, HealthController, BootstrapController, WorkspaceController, AuthController],
})
export class AppModule {}
