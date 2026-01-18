import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Session,
} from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";
import { CreateReceiptDto } from "./dto/create-receipt.dto";
import { UpdateReceiptDto } from "./dto/update-receipt.dto";
import { AllowAnonymous, type UserSession } from "@thallesp/nestjs-better-auth";

@Controller("receipts")
@AllowAnonymous()
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  create(
    @Body() createReceiptDto: CreateReceiptDto,
    @Session() session: UserSession,
  ) {
    return this.receiptsService.create(createReceiptDto, session.user.id);
  }

  @Get()
  findAll(@Session() session: UserSession) {
    return this.receiptsService.findAll(session.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.receiptsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateReceiptDto: UpdateReceiptDto) {
    return this.receiptsService.update(id, updateReceiptDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Session() session: UserSession) {
    return this.receiptsService.remove(id, session.user.id);
  }
}
