import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { AttachmentsService } from "./attachments.service";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

@Controller({ version: "1", path: "attachments" })
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAttachmentDto, @CurrentUser() user: AppUser) {
    return this.attachmentsService.createAttachment(dto, user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: AppUser) {
    await this.attachmentsService.deleteAttachment(id, user.id);
  }
}
