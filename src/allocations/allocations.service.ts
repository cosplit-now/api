import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toAllocationResponse } from "./allocations.mapper";
import { computeAllocations } from "./allocation-calculator";
import type { AllocationResponse } from "../receipts/receipts.types";
import type { PutAllocationsDto } from "./dto/put-allocations.dto";

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForReceipt(
    receiptId: string,
    userId: string,
  ): Promise<AllocationResponse[]> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      select: { userId: true },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const allocations = await this.prisma.allocation.findMany({
      where: { receiptId },
      orderBy: { createdAt: "asc" },
    });

    return allocations.map(toAllocationResponse);
  }

  async putForItem(
    itemId: string,
    dto: PutAllocationsDto,
    userId: string,
  ): Promise<AllocationResponse[]> {
    // Verify item exists and belongs to current user
    const item = await this.prisma.receiptItem.findUnique({
      where: { id: itemId },
      include: { receipt: { select: { userId: true, id: true } } },
    });

    if (!item || item.receipt.userId !== userId) {
      throw new NotFoundException();
    }

    const receiptId = item.receipt.id;
    const { allocations } = dto;

    const totalPrice = Number(item.totalPrice.toString());

    // Delegate calculation (and validation) to pure function
    const allocationData = computeAllocations(totalPrice, allocations);

    // Idempotent replace: delete existing, create new in a transaction
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.allocation.deleteMany({ where: { receiptItemId: itemId } });

      if (allocationData.length === 0) {
        return [];
      }

      const results = await Promise.all(
        allocationData.map((data) =>
          tx.allocation.create({
            data: {
              receiptId,
              receiptItemId: itemId,
              participantId: data.participantId,
              type: data.type,
              value: data.value,
              amount: data.amount,
            },
          }),
        ),
      );

      return results;
    });

    return created.map(toAllocationResponse);
  }
}
