import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateItemDto } from "./dto/create-item.dto";
import { UpdateItemDto } from "./dto/update-item.dto";
import { toItemResponse } from "./items.mapper";
import type { ItemResponse } from "../receipts/receipts.types";

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(receiptId: string, userId: string): Promise<ItemResponse[]> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const items = await this.prisma.receiptItem.findMany({
      where: { receiptId },
      orderBy: { sortOrder: "asc" },
    });

    return items.map(toItemResponse);
  }

  async create(
    receiptId: string,
    dto: CreateItemDto,
    userId: string,
  ): Promise<ItemResponse> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const item = await this.prisma.receiptItem.create({
      data: {
        receiptId,
        name: dto.name,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        totalPrice: dto.totalPrice,
        discount: dto.discount ?? "0",
        description: dto.description,
        category: dto.category,
        taxExempt: dto.taxExempt ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return toItemResponse(item);
  }

  async update(
    id: string,
    dto: UpdateItemDto,
    userId: string,
  ): Promise<ItemResponse> {
    const item = await this.prisma.receiptItem.findUnique({
      where: { id },
      include: { receipt: { select: { userId: true } } },
    });

    if (!item || item.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const updated = await this.prisma.receiptItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.totalPrice !== undefined && { totalPrice: dto.totalPrice }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.taxExempt !== undefined && { taxExempt: dto.taxExempt }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    return toItemResponse(updated);
  }

  async delete(id: string, userId: string): Promise<void> {
    const item = await this.prisma.receiptItem.findUnique({
      where: { id },
      include: { receipt: { select: { userId: true } } },
    });

    if (!item || item.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    await this.prisma.receiptItem.delete({ where: { id } });
  }
}
