import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toAllocationResponse } from "./allocations.mapper";
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

    // Validate: no duplicate participantIds
    const participantIds = allocations.map((a) => a.participantId);
    const uniqueParticipantIds = new Set(participantIds);
    if (uniqueParticipantIds.size !== participantIds.length) {
      throw new BadRequestException(
        "Each participantId must appear at most once",
      );
    }

    // Parse totalPrice as number for calculations
    const totalPrice = Number(item.totalPrice.toString());

    // Calculate amounts for each allocation
    const allocationData: Array<{
      participantId: string;
      type: "equal" | "shares" | "custom";
      value: string;
      amount: string;
    }> = [];

    if (allocations.length > 0) {
      const type = allocations[0].type;

      if (type === "equal") {
        const count = allocations.length;
        const equalAmount = (totalPrice / count).toFixed(2);

        for (const alloc of allocations) {
          allocationData.push({
            participantId: alloc.participantId,
            type: "equal",
            value: alloc.value ?? "0",
            amount: equalAmount,
          });
        }
      } else if (type === "shares") {
        const totalShares = allocations.reduce(
          (sum, a) => sum + Number(a.value ?? "0"),
          0,
        );

        if (totalShares === 0) {
          throw new UnprocessableEntityException(
            "Total shares must be greater than zero",
          );
        }

        for (const alloc of allocations) {
          const shareValue = Number(alloc.value ?? "0");
          const amount = ((totalPrice * shareValue) / totalShares).toFixed(2);

          allocationData.push({
            participantId: alloc.participantId,
            type: "shares",
            value: alloc.value ?? "0",
            amount,
          });
        }
      } else if (type === "custom") {
        const totalCustom = allocations.reduce(
          (sum, a) => sum + Number(a.value ?? "0"),
          0,
        );

        if (totalCustom > totalPrice + 0.001) {
          throw new UnprocessableEntityException(
            "Custom amounts exceed item total price",
          );
        }

        for (const alloc of allocations) {
          const customValue = alloc.value ?? "0";
          allocationData.push({
            participantId: alloc.participantId,
            type: "custom",
            value: customValue,
            amount: Number(customValue).toFixed(2),
          });
        }
      } else {
        // Fallback for mixed types (graceful handling)
        for (const alloc of allocations) {
          allocationData.push({
            participantId: alloc.participantId,
            type: alloc.type,
            value: alloc.value ?? "0",
            amount: Number(alloc.value ?? "0").toFixed(2),
          });
        }
      }
    }

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
