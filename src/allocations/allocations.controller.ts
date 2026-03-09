import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { AllocationsService } from "./allocations.service";
import { PutAllocationsDto } from "./dto/put-allocations.dto";

@Controller({ version: "1", path: "receipts/:receiptId/allocations" })
export class ReceiptAllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @CurrentUser() user: AppUser) {
    return this.allocationsService.listForReceipt(receiptId, user.id);
  }
}

@Controller({ version: "1", path: "items/:id/allocations" })
export class ItemAllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Put()
  put(
    @Param("id") itemId: string,
    @Body() dto: PutAllocationsDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.allocationsService.putForItem(itemId, dto, user.id);
  }
}
