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
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { ParticipantsService } from "./participants.service";
import { ListParticipantsDto } from "./dto/list-participants.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { UpdateParticipantDto } from "./dto/update-participant.dto";

@Controller({ version: "1", path: "participants" })
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  list(@Query() query: ListParticipantsDto, @CurrentUser() user: AppUser) {
    return this.participantsService.listAll(query, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateParticipantDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.participantsService.update(id, dto, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: AppUser) {
    await this.participantsService.delete(id, user.id);
  }
}

@Controller({ version: "1", path: "receipts/:receiptId/participants" })
export class ReceiptParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @CurrentUser() user: AppUser) {
    return this.participantsService.listForReceipt(receiptId, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Param("receiptId") receiptId: string,
    @Body() dto: AddParticipantDto,
    @CurrentUser() user: AppUser,
  ) {
    return this.participantsService.add(receiptId, dto, user.id);
  }
}
