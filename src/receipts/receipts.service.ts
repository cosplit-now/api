import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { CreateDemoReceiptDto } from "./dto/create-demo-receipt.dto";
import { UpdateDemoReceiptDto } from "./dto/update-demo-receipt.dto";
import { CreateReceiptDto } from "./dto/create-receipt.dto";
import { UpdateReceiptDto } from "./dto/update-receipt.dto";
import { ListReceiptsDto } from "./dto/list-receipts.dto";
import { PrismaService } from "../prisma/prisma.service";
import { DemoReceipt } from "generated/prisma/client";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { toReceiptResponse, toReceiptsResponse } from "./receipts.mapper";
import type { ReceiptResponse, ReceiptsResponse } from "./receipts.types";

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("receipt") private readonly receiptQueue: Queue,
  ) {}

  // ── Demo methods ─────────────────────────────────────────────────────────

  async demoCreate(
    createReceiptDto: CreateDemoReceiptDto,
  ): Promise<DemoReceipt> {
    const receipt = await this.prisma.demoReceipt.create({
      data: {
        status: "uploaded",
        imageUrl: createReceiptDto.imageUrl,
      },
    });
    await this.receiptQueue.add(
      "ocr",
      {
        receiptId: receipt.id,
        imageUrl: createReceiptDto.imageUrl,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );
    this.logger.log(`Demo receipt created: ${receipt.id}`);
    return receipt;
  }

  async demoFindAll(): Promise<DemoReceipt[]> {
    const receipts = await this.prisma.demoReceipt.findMany({
      orderBy: { createdAt: "desc" },
    });
    return receipts;
  }

  async demoFindOne(id: string) {
    const receipt = await this.prisma.demoReceipt.findUnique({
      where: { id },
    });
    if (!receipt) {
      throw new NotFoundException();
    }
    return receipt;
  }

  async demoUpdate(id: string, updateReceiptDto: UpdateDemoReceiptDto) {
    await this.prisma.demoReceipt.update({
      where: { id },
      data: { finalResult: updateReceiptDto.finalResult },
    });
    return `This action updates a #${id} receipt`;
  }

  async demoRemove(id: string) {
    await this.prisma.demoReceipt.delete({
      where: { id },
    });
    this.logger.log(`Demo receipt deleted: ${id}`);
    return `This action removes a #${id} receipt`;
  }

  // ── V1 methods ───────────────────────────────────────────────────────────

  async list(dto: ListReceiptsDto, userId: string): Promise<ReceiptsResponse> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where = {
      userId,
      ...(dto.ocrStatus ? { ocrStatus: dto.ocrStatus } : {}),
    };

    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          attachments: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return toReceiptsResponse(receipts, total, page, pageSize);
  }

  async findOne(id: string, userId: string): Promise<ReceiptResponse> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        attachments: true,
        items: true,
        participants: true,
        allocations: true,
      },
    });
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }
    return toReceiptResponse(receipt);
  }

  async create(
    dto: CreateReceiptDto,
    userId: string,
  ): Promise<ReceiptResponse> {
    const { attachmentIds } = dto;

    const attachmentMap = new Map(
      (
        await this.prisma.receiptAttachment.findMany({
          where: { id: { in: attachmentIds } },
        })
      ).map((a) => [a.id, a]),
    );

    if (attachmentMap.size !== attachmentIds.length) {
      throw new NotFoundException("One or more attachments not found");
    }

    for (const id of attachmentIds) {
      const att = attachmentMap.get(id)!;
      if (att.userId !== userId) {
        throw new NotFoundException("One or more attachments not found");
      }
      if (att.status === "attached") {
        throw new UnprocessableEntityException(
          "Attachment is already attached to a receipt",
        );
      }
      if (
        att.status === "expired" ||
        (att.expiresAt && att.expiresAt < new Date())
      ) {
        throw new UnprocessableEntityException("Attachment is expired");
      }
    }

    const receipt = await this.prisma.receipt.create({
      data: { userId },
    });

    await this.prisma.receiptAttachment.updateMany({
      where: { id: { in: attachmentIds } },
      data: { receiptId: receipt.id, status: "attached" },
    });

    const firstAttachment = attachmentMap.get(attachmentIds[0])!;
    await this.receiptQueue.add(
      "v1-ocr",
      {
        receiptId: receipt.id,
        imageKey: firstAttachment.key,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );

    this.logger.log(
      `Receipt created: ${receipt.id} for user ${userId} with ${attachmentIds.length} attachment(s)`,
    );
    return this.findOne(receipt.id, userId);
  }

  async update(
    id: string,
    dto: UpdateReceiptDto,
    userId: string,
  ): Promise<ReceiptResponse> {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    await this.prisma.receipt.update({
      where: { id },
      data: {
        ...(dto.storeName !== undefined && { storeName: dto.storeName }),
        ...(dto.storeAddress !== undefined && {
          storeAddress: dto.storeAddress,
        }),
        ...(dto.receiptDate !== undefined && {
          receiptDate: new Date(dto.receiptDate),
        }),
      },
    });

    this.logger.log(`Receipt updated: ${id} by user ${userId}`);
    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }
    await this.prisma.receipt.delete({ where: { id } });
    this.logger.log(`Receipt deleted: ${id} by user ${userId}`);
  }

  async triggerOcr(id: string, userId: string): Promise<{ ocrStatus: string }> {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }
    if (receipt.ocrStatus !== "failed") {
      throw new UnprocessableEntityException(
        "OCR can only be re-triggered when status is failed",
      );
    }

    await this.prisma.receipt.update({
      where: { id },
      data: { ocrStatus: "processing" },
    });

    const attachment = await this.prisma.receiptAttachment.findFirst({
      where: { receiptId: id },
      orderBy: { sortOrder: "asc" },
    });

    await this.receiptQueue.add(
      "v1-ocr",
      {
        receiptId: id,
        imageKey: attachment?.key,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );

    this.logger.log(`OCR re-triggered for receipt ${id} by user ${userId}`);
    return { ocrStatus: "processing" };
  }
}
