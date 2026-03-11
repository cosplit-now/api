import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { UploadsService } from "./uploads.service";
import { PresignedUrlDto } from "./dto/presigned-url.dto";

@Controller({ version: "1", path: "uploads" })
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("presigned-url")
  @HttpCode(HttpStatus.OK)
  getPresignedUrl(@Body() dto: PresignedUrlDto, @CurrentUser() user: AppUser) {
    return this.uploadsService.getPresignedUrl(dto, user.id);
  }
}
