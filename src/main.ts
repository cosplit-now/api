import "./instrument";
import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.enableCors({
    origin: ["https://localhost:5173", "https://cosplit.xinqi.mu"],
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
