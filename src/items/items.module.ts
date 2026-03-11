import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ItemsService } from "./items.service";
import { ItemsController, ReceiptItemsController } from "./items.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ReceiptItemsController, ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
