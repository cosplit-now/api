import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SummaryService } from "./summary.service";
import { SummaryController } from "./summary.controller";

@Module({
  imports: [PrismaModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
