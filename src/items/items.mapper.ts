import type { ReceiptItem } from "generated/prisma/client";
import { formatMoney } from "../common/utils/format-money";
import type { ItemResponse } from "../receipts/receipts.types";

export function toItemResponse(item: ReceiptItem): ItemResponse {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: formatMoney(item.unitPrice) as string,
    totalPrice: formatMoney(item.totalPrice) as string,
    discount: formatMoney(item.discount),
    description: item.description,
    category: item.category,
    taxExempt: item.taxExempt,
    sortOrder: item.sortOrder,
  };
}
