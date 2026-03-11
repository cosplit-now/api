import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AllocationsService } from "./allocations.service";
import {
  ReceiptAllocationsController,
  ItemAllocationsController,
} from "./allocations.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ReceiptAllocationsController, ItemAllocationsController],
  providers: [AllocationsService],
})
export class AllocationsModule {}
