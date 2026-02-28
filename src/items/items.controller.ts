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
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ItemsService } from "./items.service";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@Controller({ version: "1", path: "receipts/:receiptId/items" })
export class ReceiptItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @Session() session: UserSession) {
    return this.itemsService.list(receiptId, session.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param("receiptId") receiptId: string,
    @Body() dto: CreateItemDto,
    @Session() session: UserSession,
  ) {
    return this.itemsService.create(receiptId, dto, session.user.id);
  }
}

@Controller({ version: "1", path: "items" })
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateItemDto,
    @Session() session: UserSession,
  ) {
    return this.itemsService.update(id, dto, session.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @Session() session: UserSession) {
    await this.itemsService.delete(id, session.user.id);
  }
}
