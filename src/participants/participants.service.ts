import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ListParticipantsDto } from "./dto/list-participants.dto";
import { AddParticipantDto } from "./dto/add-participant.dto";
import { UpdateParticipantDto } from "./dto/update-participant.dto";
import { toParticipantResponse } from "./participants.mapper";
import type {
  ParticipantResponse,
  ParticipantsListResponse,
} from "../receipts/receipts.types";

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(
    dto: ListParticipantsDto,
    userId: string,
  ): Promise<ParticipantsListResponse> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const where = {
      receipt: { userId },
      ...(dto.search
        ? { name: { contains: dto.search, mode: "insensitive" as const } }
        : {}),
    };

    const [participants, total] = await Promise.all([
      this.prisma.participant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.participant.count({ where }),
    ]);

    return {
      data: participants.map(toParticipantResponse),
      meta: { total, page, pageSize },
    };
  }

  async listForReceipt(
    receiptId: string,
    userId: string,
  ): Promise<ParticipantResponse[]> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const participants = await this.prisma.participant.findMany({
      where: { receiptId },
      orderBy: { createdAt: "asc" },
    });

    return participants.map(toParticipantResponse);
  }

  async add(
    receiptId: string,
    dto: AddParticipantDto,
    userId: string,
  ): Promise<ParticipantResponse> {
    const hasName = dto.name !== undefined;
    const hasId = dto.participantId !== undefined;

    if (hasName === hasId) {
      throw new BadRequestException(
        "Provide exactly one of name or participantId",
      );
    }

    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    if (hasName) {
      const participant = await this.prisma.participant.create({
        data: { receiptId, name: dto.name! },
      });
      return toParticipantResponse(participant);
    }

    // attach existing: copy participant into this receipt
    const source = await this.prisma.participant.findUnique({
      where: { id: dto.participantId },
      include: { receipt: { select: { userId: true } } },
    });

    if (!source || source.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const participant = await this.prisma.participant.create({
      data: { receiptId, name: source.name },
    });

    return toParticipantResponse(participant);
  }

  async update(
    id: string,
    dto: UpdateParticipantDto,
    userId: string,
  ): Promise<ParticipantResponse> {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: { receipt: { select: { userId: true } } },
    });

    if (!participant || participant.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const updated = await this.prisma.participant.update({
      where: { id },
      data: { name: dto.name },
    });

    return toParticipantResponse(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: { receipt: { select: { userId: true } } },
    });

    if (!participant || participant.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    await this.prisma.participant.delete({ where: { id } });
  }
}
