import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  VERSION_NEUTRAL,
  Version,
} from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { CreateDemoReceiptDto } from "./dto/create-demo-receipt.dto";
import { UpdateDemoReceiptDto } from "./dto/update-demo-receipt.dto";
import { CreateReceiptDto } from "./dto/create-receipt.dto";
import { UpdateReceiptDto } from "./dto/update-receipt.dto";
import { ListReceiptsDto } from "./dto/list-receipts.dto";
import { CurrentUser, Public } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  // ── Demo routes (VERSION_NEUTRAL → /receipts/...) ────────────────────────
  // These routes are temporarily public; the DemoReceipt feature will be
  // removed in a future cleanup once the product flow is finalised.

  @Version(VERSION_NEUTRAL)
  @Post()
  @Public()
  demoCreate(@Body() createReceiptDto: CreateDemoReceiptDto) {
    return this.receiptsService.demoCreate(createReceiptDto);
  }

  @Version(VERSION_NEUTRAL)
  @Get()
  @Public()
  demoFindAll() {
    return this.receiptsService.demoFindAll();
  }

  @Version(VERSION_NEUTRAL)
  @Get(":id")
  @Public()
  demoFindOne(@Param("id") id: string) {
    return this.receiptsService.demoFindOne(id);
  }

  @Version(VERSION_NEUTRAL)
  @Patch(":id")
  @Public()
  demoUpdate(
    @Param("id") id: string,
    @Body() updateReceiptDto: UpdateDemoReceiptDto,
  ) {
    return this.receiptsService.demoUpdate(id, updateReceiptDto);
  }

  @Version(VERSION_NEUTRAL)
  @Delete(":id")
  @Public()
  demoRemove(@Param("id") id: string) {
    return this.receiptsService.demoRemove(id);
  }

  // ── V1 routes (@Version('1') → /v1/receipts/...) ─────────────────────────

  @Version("1")
  @Get()
  list(@Query() query: ListReceiptsDto, @CurrentUser() user: AppUser) {
    return this.receiptsService.list(query, user.id);
  }

  @Version("1")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AppUser) {
    return this.receiptsService.findOne(id, user.id);
  }

  @Version("1")
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: AppUser) {
    return this.receiptsService.create(dto, user.id);
  }

  @Version("1")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateReceiptDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.receiptsService.update(id, dto, user.id);
  }

  @Version("1")
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: AppUser) {
    await this.receiptsService.delete(id, user.id);
  }

  @Version("1")
  @Post(":id/ocr")
  @HttpCode(HttpStatus.OK)
  triggerOcr(@Param("id") id: string, @CurrentUser() user: AppUser) {
    return this.receiptsService.triggerOcr(id, user.id);
  }
}
