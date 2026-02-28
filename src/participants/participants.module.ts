import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ParticipantsService } from "./participants.service";
import {
  ParticipantsController,
  ReceiptParticipantsController,
} from "./participants.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ParticipantsController, ReceiptParticipantsController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
