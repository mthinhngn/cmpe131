import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser("json", { limit: "1100kb" });
  app.setGlobalPrefix("api/v1");
  app.enableCors({ credentials: true, origin: [...new Set(["http://localhost:5175", "http://127.0.0.1:5175", ...(process.env.WEB_ORIGIN ?? "").split(",").filter(Boolean)])] });
  await app.listen(Number(process.env.PORT ?? 3004));
}

void bootstrap();
