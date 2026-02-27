/**
 * Phase 7: Summary E2E tests
 *
 * Endpoints covered:
 *   GET /v1/receipts/:id/summary
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 */

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SummaryModule } from "../src/summary/summary.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";
import { App } from "supertest/types";

const OTHER_USER_ID = "other-user-id";

describe("GET /v1/receipts/:id/summary", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([SummaryModule]);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const makeReceipt = (
    userId = TEST_USER.id,
    opts: {
      subtotal?: string;
      taxAmount?: string;
      discount?: string;
      totalAmount?: string;
    } = {},
  ) =>
    prisma.receipt.create({
      data: {
        userId,
        subtotal: opts.subtotal ?? null,
        taxAmount: opts.taxAmount ?? null,
        discount: opts.discount ?? null,
        totalAmount: opts.totalAmount ?? null,
      },
    });

  const makeItem = (receiptId: string, name: string, totalPrice: string) =>
    prisma.receiptItem.create({
      data: {
        receiptId,
        name,
        quantity: 1,
        unitPrice: totalPrice,
        totalPrice,
      },
    });

  const makeParticipant = (receiptId: string, name: string) =>
    prisma.participant.create({ data: { receiptId, name } });

  const makeAllocation = (
    receiptId: string,
    receiptItemId: string,
    participantId: string,
    type: "equal" | "shares" | "custom",
    value: string,
    amount: string,
  ) =>
    prisma.allocation.create({
      data: { receiptId, receiptItemId, participantId, type, value, amount },
    });

  // ── Tests ─────────────────────────────────────────────────────────────────

  it("returns summary with items, participants, and totals", async () => {
    const receipt = await makeReceipt(TEST_USER.id, {
      subtotal: "999.99",
      taxAmount: "0.00",
      discount: "0.00",
      totalAmount: "999.99",
    });
    const item = await makeItem(receipt.id, "iPhone 15", "999.99");
    const alice = await makeParticipant(receipt.id, "Alice");
    const bob = await makeParticipant(receipt.id, "Bob");
    const charlie = await makeParticipant(receipt.id, "Charlie");

    await makeAllocation(receipt.id, item.id, alice.id, "equal", "0", "333.33");
    await makeAllocation(receipt.id, item.id, bob.id, "equal", "0", "333.33");
    await makeAllocation(
      receipt.id,
      item.id,
      charlie.id,
      "equal",
      "0",
      "333.33",
    );

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    const body = res.body;

    // items array
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    const summaryItem = body.items[0];
    expect(summaryItem.itemId).toBe(item.id);
    expect(summaryItem.name).toBe("iPhone 15");
    expect(summaryItem.totalPrice).toBe("999.99");
    expect(Array.isArray(summaryItem.allocations)).toBe(true);
    expect(summaryItem.allocations).toHaveLength(3);

    // item allocation shape
    const alloc = summaryItem.allocations[0];
    expect(alloc.participantId).toEqual(expect.any(String));
    expect(alloc.participantName).toEqual(expect.any(String));
    expect(alloc.amount).toEqual(expect.any(String));

    // participants array
    expect(Array.isArray(body.participants)).toBe(true);
    expect(body.participants).toHaveLength(3);
    const summaryParticipant = body.participants[0];
    expect(summaryParticipant.id).toEqual(expect.any(String));
    expect(summaryParticipant.name).toEqual(expect.any(String));
    expect(summaryParticipant.totalAmount).toEqual(expect.any(String));

    // totals
    expect(body.totals).toBeDefined();
    expect(body.totals.subtotal).toBe("999.99");
    expect(body.totals.tax).toBe("0.00");
    expect(body.totals.discount).toBe("0.00");
    expect(body.totals.total).toBe("999.99");
  });

  it("correctly sums participant totals across multiple items", async () => {
    const receipt = await makeReceipt();
    const item1 = await makeItem(receipt.id, "Item A", "100.00");
    const item2 = await makeItem(receipt.id, "Item B", "50.00");
    const alice = await makeParticipant(receipt.id, "Alice");
    const bob = await makeParticipant(receipt.id, "Bob");

    // item1: Alice 60, Bob 40
    await makeAllocation(
      receipt.id,
      item1.id,
      alice.id,
      "custom",
      "60.00",
      "60.00",
    );
    await makeAllocation(
      receipt.id,
      item1.id,
      bob.id,
      "custom",
      "40.00",
      "40.00",
    );
    // item2: Alice 50
    await makeAllocation(
      receipt.id,
      item2.id,
      alice.id,
      "custom",
      "50.00",
      "50.00",
    );

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    const byId: Record<string, string> = {};
    for (const p of res.body.participants) {
      byId[p.id] = p.totalAmount;
    }

    expect(byId[alice.id]).toBe("110.00");
    expect(byId[bob.id]).toBe("40.00");
  });

  it("returns empty items and participants arrays when receipt has no items", async () => {
    const receipt = await makeReceipt();

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    expect(res.body.items).toEqual([]);
    expect(res.body.participants).toEqual([]);
  });

  it("returns items with empty allocations when no allocations exist", async () => {
    const receipt = await makeReceipt();
    await makeItem(receipt.id, "Lonely Item", "20.00");

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].allocations).toEqual([]);
  });

  it("totals fall back to 0.00 when receipt has no monetary fields", async () => {
    const receipt = await makeReceipt(); // no subtotal/tax/discount/total

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    expect(res.body.totals.subtotal).toBe("0.00");
    expect(res.body.totals.tax).toBe("0.00");
    expect(res.body.totals.discount).toBe("0.00");
    expect(res.body.totals.total).toBe("0.00");
  });

  it("returns 404 if receipt not found", async () => {
    await request(app.getHttpServer())
      .get("/v1/receipts/rec_missing/summary")
      .expect(404);
  });

  it("returns 404 if receipt belongs to another user", async () => {
    const receipt = await makeReceipt(OTHER_USER_ID);

    await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(404);
  });

  it("participant names appear correctly in item allocations", async () => {
    const receipt = await makeReceipt();
    const item = await makeItem(receipt.id, "Pizza", "30.00");
    const alice = await makeParticipant(receipt.id, "Alice");
    const bob = await makeParticipant(receipt.id, "Bob");

    await makeAllocation(receipt.id, item.id, alice.id, "equal", "0", "15.00");
    await makeAllocation(receipt.id, item.id, bob.id, "equal", "0", "15.00");

    const res = await request(app.getHttpServer())
      .get(`/v1/receipts/${receipt.id}/summary`)
      .expect(200);

    const allocNames = res.body.items[0].allocations.map(
      (a: any) => a.participantName,
    );
    expect(allocNames).toEqual(expect.arrayContaining(["Alice", "Bob"]));
  });
});
