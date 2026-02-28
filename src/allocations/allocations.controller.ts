import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { AllocationsService } from "./allocations.service";
import { PutAllocationsDto } from "./dto/put-allocations.dto";

@Controller({ version: "1", path: "receipts/:receiptId/allocations" })
export class ReceiptAllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @Session() session: UserSession) {
    return this.allocationsService.listForReceipt(receiptId, session.user.id);
  }
}

@Controller({ version: "1", path: "items/:id/allocations" })
export class ItemAllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Put()
  put(
    @Param("id") itemId: string,
    @Body() dto: PutAllocationsDto,
    @Session() session: UserSession,
  ) {
    return this.allocationsService.putForItem(itemId, dto, session.user.id);
  }
}
