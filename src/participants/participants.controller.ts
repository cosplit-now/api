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
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { ParticipantsService } from "./participants.service";
import { ListParticipantsDto } from "./dto/list-participants.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { UpdateParticipantDto } from "./dto/update-participant.dto";

@Controller({ version: "1", path: "participants" })
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  list(@Query() query: ListParticipantsDto, @Session() session: UserSession) {
    return this.participantsService.listAll(query, session.user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateParticipantDto,
    @Session() session: UserSession,
  ) {
    return this.participantsService.update(id, dto, session.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @Session() session: UserSession) {
    await this.participantsService.delete(id, session.user.id);
  }
}

@Controller({ version: "1", path: "receipts/:receiptId/participants" })
export class ReceiptParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  list(@Param("receiptId") receiptId: string, @Session() session: UserSession) {
    return this.participantsService.listForReceipt(receiptId, session.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Param("receiptId") receiptId: string,
    @Body() dto: AddParticipantDto,
    @Session() session: UserSession,
  ) {
    return this.participantsService.add(receiptId, dto, session.user.id);
  }
}
