import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { UploadsService } from "./uploads.service";
import { PresignedUrlDto } from "./dto/presigned-url.dto";

@Controller({ version: "1", path: "uploads" })
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("presigned-url")
  @HttpCode(HttpStatus.OK)
  getPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @Session() session: UserSession,
  ) {
    return this.uploadsService.getPresignedUrl(dto, session.user.id);
  }
}
