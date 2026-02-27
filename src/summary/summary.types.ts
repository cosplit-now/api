export interface SummaryItemAllocation {
  participantId: string;

  participantName: string;

  amount: string;
}

export interface SummaryItem {
  itemId: string;

  name: string;

  totalPrice: string;

  allocations: SummaryItemAllocation[];
}

export interface SummaryParticipant {
  id: string;

  name: string;

  totalAmount: string;
}

export interface SummaryTotals {
  subtotal: string;

  tax: string;

  discount: string;

  total: string;
}

export interface SummaryResponse {
  items: SummaryItem[];

  participants: SummaryParticipant[];

  totals: SummaryTotals;
}
