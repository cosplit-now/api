import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AttachmentsModule } from "./attachments/attachments.module";
import { type EnvironmentVariables, validateEnv } from "./config/env.schema";
import { HealthModule } from "./health/health.module";
import { createAuth } from "./lib/auth";
import { AllocationsModule } from "./allocations/allocations.module";
import { ItemsModule } from "./items/items.module";
import { ParticipantsModule } from "./participants/participants.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReceiptProcessorModule } from "./receipts/receipt-processor.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { S3Module } from "./s3/s3.module";
import { SummaryModule } from "./summary/summary.module";
import { UploadsModule } from "./uploads/uploads.module";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? "development"}`, ".env"],
      validate: validateEnv,
    }),
    SentryModule.forRoot(),
    AuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        auth: createAuth({
          TRUSTED_ORIGINS: configService.get("TRUSTED_ORIGINS", {
            infer: true,
          }),
          SESSION_COOKIE_DOMAIN: configService.get("SESSION_COOKIE_DOMAIN", {
            infer: true,
          }),
        }),
      }),
    }),
    PrismaModule,
    S3Module,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        connection: {
          host: configService.get("REDIS_HOST", { infer: true }),
          port: configService.get("REDIS_PORT", { infer: true }),
        },
      }),
    }),
    ReceiptsModule,
    ReceiptProcessorModule,
    UploadsModule,
    AttachmentsModule,
    ItemsModule,
    ParticipantsModule,
    AllocationsModule,
    SummaryModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    AppService,
  ],
})
export class AppModule {}
