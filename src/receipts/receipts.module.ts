import { ReceiptQueueProcessor } from "./receipt-queue.processor";
import { Module } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { ReceiptsController } from "./receipts.controller";
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [BullModule.registerQueue({ name: "receipt" })],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptQueueProcessor],
})
export class ReceiptsModule {}
