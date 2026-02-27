export interface AttachmentResponse {
  id: string;
  key: string;
  bucket: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  originalName: string | null;
  sortOrder: number;
}

export interface ItemResponse {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  discount: string | null;
  description: string | null;
  category: string | null;
  taxExempt: boolean;
  sortOrder: number;
}

export interface ParticipantResponse {
  id: string;
  name: string;
  createdAt: Date;
}

export interface AllocationResponse {
  id: string;
  participantId: string;
  receiptItemId: string;
  type: string;
  value: string;
  createdAt: Date;
}

export interface ReceiptResponse {
  id: string;
  userId: string;
  storeName: string | null;
  storeAddress: string | null;
  receiptDate: Date | null;
  subtotal: string | null;
  discount: string | null;
  taxAmount: string | null;
  totalAmount: string | null;
  ocrStatus: string;
  ocrResult: unknown;
  createdAt: Date;
  updatedAt: Date;
  attachments: AttachmentResponse[];
  items: ItemResponse[];
  participants: ParticipantResponse[];
  allocations: AllocationResponse[];
}

export interface ReceiptListItemResponse {
  id: string;
  storeName: string | null;
  totalAmount: string | null;
  ocrStatus: string;
  attachmentUrl: string | null;
  createdAt: Date;
}

export interface ReceiptsResponse {
  data: ReceiptListItemResponse[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}
