import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateReceiptDto } from "./dto/create-receipt.dto";
import { UpdateReceiptDto } from "./dto/update-receipt.dto";
import { PrismaService } from "../prisma/prisma.service";
import { DemoReceipt } from "generated/prisma/client";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("receipt") private readonly receiptQueue: Queue,
  ) {}

  async create(createReceiptDto: CreateReceiptDto, userId: string) {
    const receipt = await this.prisma.demoReceipt.create({
      data: {
        status: "uploaded",
        imageUrl: createReceiptDto.imageUrl,
        userId,
      },
    });
    await this.receiptQueue.add("ocr", {
      receiptId: receipt.id,
      imageUrl: createReceiptDto.imageUrl,
    });
    return receipt;
  }

  async findAll(userId: string): Promise<DemoReceipt[]> {
    const receipts = await this.prisma.demoReceipt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return receipts;
  }

  async findOne(id: string) {
    const receipt = await this.prisma.demoReceipt.findUnique({
      where: { id },
    });
    if (!receipt) {
      return new NotFoundException();
    }
    return receipt;
  }

  async update(id: string, updateReceiptDto: UpdateReceiptDto) {
    await this.prisma.demoReceipt.update({
      where: { id },
      data: { finalResult: updateReceiptDto.finalResult },
    });
    return `This action updates a #${id} receipt`;
  }

  async remove(id: string, userId: string) {
    await this.prisma.demoReceipt.delete({
      where: { id, userId },
    });
    return `This action removes a #${id} receipt`;
  }
}
