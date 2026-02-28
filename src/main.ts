import "./instrument";
import { NestFactory } from "@nestjs/core";
import { ConsoleLogger, Logger, VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { EnvironmentVariables } from "./config/env.schema";

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === "production";

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.useLogger(
    new ConsoleLogger({
      timestamp: true,
      logLevels: isProduction
        ? ["log", "warn", "error", "fatal"]
        : ["log", "warn", "error", "fatal", "debug", "verbose"],
    }),
  );

  const logger = new Logger("Bootstrap");

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
  logger.log(`Application is running on port ${port}`);
}
void bootstrap();
