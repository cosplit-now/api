import type { Allocation } from "generated/prisma/client";
import { formatMoney } from "../common/utils/format-money";
import type { AllocationResponse } from "../receipts/receipts.types";

export function toAllocationResponse(
  allocation: Allocation,
): AllocationResponse {
  return {
    id: allocation.id,

    participantId: allocation.participantId,

    receiptItemId: allocation.receiptItemId,

    type: allocation.type,

    value: formatMoney(allocation.value) as string,

    amount: formatMoney(allocation.amount) as string,

    createdAt: allocation.createdAt,
  };
}
