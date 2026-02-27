import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { SummaryService } from "./summary.service";
import { PrismaService } from "../prisma/prisma.service";
import Decimal from "decimal.js";

// Decimal.js helper for Decimal-like Prisma fields in tests
const dec = (v: string | number) => new Decimal(v);

const USER_ID = "user-1";
const OTHER_USER_ID = "other-user";

describe("SummaryService", () => {
  let service: SummaryService;
  let prisma: { receipt: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prisma = { receipt: { findUnique: vi.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SummaryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SummaryService);
  });

  it("throws 404 when receipt is missing", async () => {
    prisma.receipt.findUnique.mockResolvedValue(null);
    await expect(service.getForReceipt("rx", USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws 404 when receipt belongs to another user", async () => {
    prisma.receipt.findUnique.mockResolvedValue({
      userId: OTHER_USER_ID,
      items: [],
      participants: [],
      allocations: [],
      subtotal: null,
      taxAmount: null,
      discount: null,
      totalAmount: null,
    });
    await expect(service.getForReceipt("rx", USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  describe("items mapping", () => {
    it("returns empty items / participants for empty receipt", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [],
        participants: [],
        allocations: [],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.items).toEqual([]);
      expect(result.participants).toEqual([]);
    });

    it("fills participantName when allocations exist", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [
          { id: "i1", name: "Pizza", totalPrice: dec("30.00"), sortOrder: 0 },
        ],
        participants: [{ id: "p1", name: "Alice", createdAt: new Date() }],
        allocations: [
          {
            receiptItemId: "i1",
            participantId: "p1",
            amount: dec("15.00"),
          },
          {
            receiptItemId: "i1",
            participantId: "p1",
            amount: dec("15.00"),
          },
        ],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.items[0].allocations[0].participantName).toBe("Alice");
    });

    it("returns empty allocations when item has no allocation", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [
          { id: "i1", name: "Solo", totalPrice: dec("20.00"), sortOrder: 0 },
        ],
        participants: [],
        allocations: [],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.items[0].allocations).toEqual([]);
    });
  });

  describe("participants aggregation", () => {
    it("sums totalAmount across multiple items", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [
          { id: "i1", name: "A", totalPrice: dec("100"), sortOrder: 0 },
          { id: "i2", name: "B", totalPrice: dec("50"), sortOrder: 1 },
        ],
        participants: [
          { id: "p1", name: "Alice", createdAt: new Date() },
          { id: "p2", name: "Bob", createdAt: new Date() },
        ],
        allocations: [
          { receiptItemId: "i1", participantId: "p1", amount: dec("60") },
          { receiptItemId: "i1", participantId: "p2", amount: dec("40") },
          { receiptItemId: "i2", participantId: "p1", amount: dec("50") },
        ],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      const byId: Record<string, string> = {};
      result.participants.forEach((p) => (byId[p.id] = p.totalAmount));

      expect(byId["p1"]).toBe("110.00");
      expect(byId["p2"]).toBe("40.00");
    });

    it("omits participants with no allocations", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [],
        participants: [{ id: "p1", name: "Ghost", createdAt: new Date() }],
        allocations: [],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.participants).toEqual([]);
    });
  });

  describe("totals", () => {
    it("falls back to 0.00 for null fields", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [],
        participants: [],
        allocations: [],
        subtotal: null,
        taxAmount: null,
        discount: null,
        totalAmount: null,
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.totals).toEqual({
        subtotal: "0.00",
        tax: "0.00",
        discount: "0.00",
        total: "0.00",
      });
    });

    it("formats totals when values are present", async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        userId: USER_ID,
        items: [],
        participants: [],
        allocations: [],
        subtotal: dec("999.99"),
        taxAmount: dec("10"),
        discount: dec("5.5"),
        totalAmount: dec("1004.49"),
      });

      const result = await service.getForReceipt("rx", USER_ID);
      expect(result.totals).toEqual({
        subtotal: "999.99",
        tax: "10.00",
        discount: "5.50",
        total: "1004.49",
      });
    });
  });
});
