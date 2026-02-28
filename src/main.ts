import "./instrument";
import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { EnvironmentVariables } from "./config/env.schema";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  app.use(helmet());
  const corsOrigins = configService.get("CORS_ORIGINS", { infer: true });
  const corsOriginList = corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOriginList,
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI });
  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
}
void bootstrap();
