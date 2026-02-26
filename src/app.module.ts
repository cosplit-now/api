import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./lib/auth";
import { PrismaModule } from "./prisma/prisma.module";
import { S3Module } from "./s3/s3.module";
import { BullModule } from "@nestjs/bullmq";
import { ReceiptsModule } from "./receipts/receipts.module";
import { ReceiptProcessorModule } from "./receipts/receipt-processor.module";
import { UploadsModule } from "./uploads/uploads.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";

@Module({
  imports: [
    SentryModule.forRoot(),
    AuthModule.forRoot({ auth }),
    PrismaModule,
    S3Module,
    BullModule.forRoot({
      connection: {
        host: process.env["REDIS_HOST"],
        port: Number(process.env["REDIS_PORT"] ?? "6379"),
      },
    }),
    ReceiptsModule,
    ReceiptProcessorModule,
    UploadsModule,
    AttachmentsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    AppService,
  ],
})
export class AppModule {}
