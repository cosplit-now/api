import { Controller, Get, Param } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { SummaryService } from "./summary.service";

@Controller({ version: "1", path: "receipts/:id/summary" })
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  get(@Param("id") id: string, @Session() session: UserSession) {
    return this.summaryService.getForReceipt(id, session.user.id);
  }
}
