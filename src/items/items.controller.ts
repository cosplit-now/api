import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { ItemsService } from "./items.service";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@Controller({ version: "1", path: "receipts/:receiptId/items" })
export class ReceiptItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @CurrentUser() user: AppUser) {
    return this.itemsService.list(receiptId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param("receiptId") receiptId: string,
    @Body() dto: CreateItemDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.itemsService.create(receiptId, dto, user.id);
  }
}

@Controller({ version: "1", path: "items" })
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.itemsService.update(id, dto, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: AppUser) {
    await this.itemsService.delete(id, user.id);
  }
}
