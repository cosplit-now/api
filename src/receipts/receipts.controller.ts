import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Session,
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
import { AllowAnonymous, type UserSession } from "@thallesp/nestjs-better-auth";

@Controller("receipts")
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  // ── Demo routes (VERSION_NEUTRAL → /receipts/...) ────────────────────────

  @Version(VERSION_NEUTRAL)
  @Post()
  @AllowAnonymous()
  demoCreate(
    @Body() createReceiptDto: CreateDemoReceiptDto,
    @Session() session: UserSession,
  ) {
    return this.receiptsService.demoCreate(createReceiptDto, session.user.id);
  }

  @Version(VERSION_NEUTRAL)
  @Get()
  @AllowAnonymous()
  demoFindAll(@Session() session: UserSession) {
    return this.receiptsService.demoFindAll(session.user.id);
  }

  @Version(VERSION_NEUTRAL)
  @Get(":id")
  @AllowAnonymous()
  demoFindOne(@Param("id") id: string) {
    return this.receiptsService.demoFindOne(id);
  }

  @Version(VERSION_NEUTRAL)
  @Patch(":id")
  @AllowAnonymous()
  demoUpdate(
    @Param("id") id: string,
    @Body() updateReceiptDto: UpdateDemoReceiptDto,
  ) {
    return this.receiptsService.demoUpdate(id, updateReceiptDto);
  }

  @Version(VERSION_NEUTRAL)
  @Delete(":id")
  @AllowAnonymous()
  demoRemove(@Param("id") id: string, @Session() session: UserSession) {
    return this.receiptsService.demoRemove(id, session.user.id);
  }

  // ── V1 routes (@Version('1') → /v1/receipts/...) ─────────────────────────

  @Version("1")
  @Get()
  list(@Query() query: ListReceiptsDto, @Session() session: UserSession) {
    return this.receiptsService.list(query, session.user.id);
  }

  @Version("1")
  @Get(":id")
  findOne(@Param("id") id: string, @Session() session: UserSession) {
    return this.receiptsService.findOne(id, session.user.id);
  }

  @Version("1")
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReceiptDto, @Session() session: UserSession) {
    return this.receiptsService.create(dto, session.user.id);
  }

  @Version("1")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateReceiptDto,
    @Session() session: UserSession,
  ) {
    return this.receiptsService.update(id, dto, session.user.id);
  }

  @Version("1")
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @Session() session: UserSession) {
    await this.receiptsService.delete(id, session.user.id);
  }

  @Version("1")
  @Post(":id/ocr")
  @HttpCode(HttpStatus.OK)
  triggerOcr(@Param("id") id: string, @Session() session: UserSession) {
    return this.receiptsService.triggerOcr(id, session.user.id);
  }
}
