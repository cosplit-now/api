import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { ReceiptQueueProcessor } from "./receipt-queue.processor";

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: "receipt" })],
  providers: [ReceiptQueueProcessor],
})
export class ReceiptProcessorModule {}
