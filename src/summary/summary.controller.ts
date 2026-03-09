import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators";
import type { AppUser } from "../auth/auth.types";
import { SummaryService } from "./summary.service";

@Controller({ version: "1", path: "receipts/:id/summary" })
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  get(@Param("id") id: string, @CurrentUser() user: AppUser) {
    return this.summaryService.getForReceipt(id, user.id);
  }
}
