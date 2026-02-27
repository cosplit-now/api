import type {
  Receipt,
  ReceiptAttachment,
  ReceiptItem,
  Participant,
  Allocation,
} from "generated/prisma/client";
import { formatMoney } from "../common/utils/format-money";
import type {
  AttachmentResponse,
  ItemResponse,
  ParticipantResponse,
  AllocationResponse,
  ReceiptResponse,
  ReceiptListItemResponse,
  ReceiptsResponse,
} from "./receipts.types";

export function toAttachmentResponse(
  attachment: ReceiptAttachment,
): AttachmentResponse {
  return {
    id: attachment.id,
    key: attachment.key,
    bucket: attachment.bucket,
    url: attachment.url,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    originalName: attachment.originalName,
    sortOrder: attachment.sortOrder,
  };
}

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

export function toParticipantResponse(
  participant: Participant,
): ParticipantResponse {
  return {
    id: participant.id,
    name: participant.name,
    createdAt: participant.createdAt,
  };
}

export function toAllocationResponse(
  allocation: Allocation,
): AllocationResponse {
  return {
    id: allocation.id,
    participantId: allocation.participantId,
    receiptItemId: allocation.receiptItemId,
    type: allocation.type,
    value: allocation.value.toString(),
    createdAt: allocation.createdAt,
  };
}

type ReceiptWithRelations = Receipt & {
  attachments: ReceiptAttachment[];
  items: ReceiptItem[];
  participants: Participant[];
  allocations: Allocation[];
};

export function toReceiptResponse(
  receipt: ReceiptWithRelations,
): ReceiptResponse {
  return {
    id: receipt.id,
    userId: receipt.userId,
    storeName: receipt.storeName,
    storeAddress: receipt.storeAddress,
    receiptDate: receipt.receiptDate,
    subtotal: formatMoney(receipt.subtotal),
    discount: formatMoney(receipt.discount),
    taxAmount: formatMoney(receipt.taxAmount),
    totalAmount: formatMoney(receipt.totalAmount),
    ocrStatus: receipt.ocrStatus,
    ocrResult: receipt.ocrResult,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    attachments: receipt.attachments.map(toAttachmentResponse),
    items: receipt.items.map(toItemResponse),
    participants: receipt.participants.map(toParticipantResponse),
    allocations: receipt.allocations.map(toAllocationResponse),
  };
}

export function toReceiptListItemResponse(
  receipt: Receipt,
  attachmentUrl: string | null,
): ReceiptListItemResponse {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    totalAmount: formatMoney(receipt.totalAmount),
    ocrStatus: receipt.ocrStatus,
    attachmentUrl,
    createdAt: receipt.createdAt,
  };
}

export function toReceiptsResponse(
  receipts: Array<Receipt & { attachments: ReceiptAttachment[] }>,
  total: number,
  page: number,
  pageSize: number,
): ReceiptsResponse {
  return {
    data: receipts.map((r) => {
      const { attachments, ...receipt } = r;
      return toReceiptListItemResponse(
        receipt as Receipt,
        attachments[0]?.url ?? null,
      );
    }),
    meta: { total, page, pageSize },
  };
}
