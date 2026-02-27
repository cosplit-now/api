import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { formatMoney } from "../common/utils/format-money";
import Decimal from "decimal.js";
import type {
  SummaryResponse,
  SummaryItem,
  SummaryParticipant,
} from "./summary.types";

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getForReceipt(
    receiptId: string,
    userId: string,
  ): Promise<SummaryResponse> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        participants: { orderBy: { createdAt: "asc" } },
        allocations: true,
      },
    });

    if (!receipt || receipt.userId !== userId) {
      throw new NotFoundException();
    }

    // Build a map of participantId -> participant for quick lookups
    const participantMap = new Map(receipt.participants.map((p) => [p.id, p]));

    // Build items with their allocations
    const items: SummaryItem[] = receipt.items.map((item) => {
      const itemAllocations = receipt.allocations.filter(
        (a) => a.receiptItemId === item.id,
      );

      return {
        itemId: item.id,
        name: item.name,
        totalPrice: formatMoney(item.totalPrice) as string,
        allocations: itemAllocations.map((a) => ({
          participantId: a.participantId,
          participantName: participantMap.get(a.participantId)?.name ?? "",
          amount: formatMoney(a.amount) as string,
        })),
      };
    });

    // Aggregate per-participant totals
    const participantTotals = new Map<string, Decimal>();
    for (const alloc of receipt.allocations) {
      const current = participantTotals.get(alloc.participantId);
      participantTotals.set(
        alloc.participantId,
        (current ?? new Decimal(0)).plus(new Decimal(alloc.amount.toString())),
      );
    }

    // Only include participants that actually appear in allocations,
    // ordered by their original creation order
    const participants: SummaryParticipant[] = receipt.participants
      .filter((p) => participantTotals.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        totalAmount: (participantTotals.get(p.id) ?? new Decimal(0)).toFixed(2),
      }));

    return {
      items,
      participants,
      totals: {
        subtotal: formatMoney(receipt.subtotal) ?? "0.00",
        tax: formatMoney(receipt.taxAmount) ?? "0.00",
        discount: formatMoney(receipt.discount) ?? "0.00",
        total: formatMoney(receipt.totalAmount) ?? "0.00",
      },
    };
  }
}
