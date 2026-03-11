import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { S3Module } from "../s3/s3.module";
import { ReceiptQueueProcessor } from "./receipt-queue.processor";

@Module({
  imports: [
    PrismaModule,
    S3Module,
    BullModule.registerQueue({ name: "receipt" }),
  ],
  providers: [ReceiptQueueProcessor],
})
export class ReceiptProcessorModule {}
