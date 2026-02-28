/**
 * Phase 6: Allocations E2E tests
 *
 * Endpoints covered:
 *   GET /v1/receipts/:receiptId/allocations
 *   PUT /v1/items/:id/allocations
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 */

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AllocationsModule } from "../src/allocations/allocations.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";
import { App } from "supertest/types";

const OTHER_USER_ID = "other-user-id";

describe("/v1 allocations", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([AllocationsModule]);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const makeReceipt = (userId = TEST_USER.id) =>
    prisma.receipt.create({ data: { userId } });

  const makeItem = (receiptId: string, totalPrice = "100.00") =>
    prisma.receiptItem.create({
      data: {
        receiptId,
        name: "Test Item",
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
    type: "equal" | "shares" | "custom" = "equal",
    value = "0",
    amount = "50.00",
  ) =>
    prisma.allocation.create({
      data: {
        receiptId,
        receiptItemId,
        participantId,
        type,
        value,
        amount,
      },
    });

  // ── GET /v1/receipts/:receiptId/allocations ───────────────────────────────

  describe("GET /v1/receipts/:receiptId/allocations", () => {
    it("returns list of allocations for a receipt", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p1 = await makeParticipant(receipt.id, "Alice");
      const p2 = await makeParticipant(receipt.id, "Bob");

      await makeAllocation(receipt.id, item.id, p1.id, "equal", "0", "50.00");
      await makeAllocation(receipt.id, item.id, p2.id, "equal", "0", "50.00");

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/allocations`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it("each allocation has id, participantId, receiptItemId, type, value, amount, createdAt", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p = await makeParticipant(receipt.id, "Alice");

      await makeAllocation(
        receipt.id,
        item.id,
        p.id,
        "custom",
        "30.00",
        "30.00",
      );

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/allocations`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const allocList = res.body as Array<{
        id: string;
        participantId: string;
        receiptItemId: string;
        type: string;
        value: string;
        amount: string;
        createdAt: string;
      }>;
      expect(allocList[0]).toHaveProperty("id");
      expect(allocList[0].participantId).toBe(p.id);
      expect(allocList[0].receiptItemId).toBe(item.id);
      expect(allocList[0].type).toBe("custom");
      expect(allocList[0].value).toBe("30.00");
      expect(allocList[0].amount).toBe("30.00");
      expect(allocList[0]).toHaveProperty("createdAt");
      expect(Number.isNaN(Date.parse(allocList[0].createdAt))).toBe(false);
    });

    it("returns empty list when receipt has no allocations", async () => {
      const receipt = await makeReceipt();

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/allocations`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .get("/v1/receipts/rec_missing/allocations")
        .expect(404);
    });

    it("returns 404 if receipt belongs to another user", async () => {
      const receipt = await makeReceipt(OTHER_USER_ID);

      await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/allocations`)
        .expect(404);
    });
  });

  // ── PUT /v1/items/:id/allocations ────────────────────────────────────────

  describe("PUT /v1/items/:id/allocations", () => {
    it("sets equal allocations and calculates amounts", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p1 = await makeParticipant(receipt.id, "Alice");
      const p2 = await makeParticipant(receipt.id, "Bob");

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [
            { participantId: p1.id, type: "equal", value: "0" },
            { participantId: p2.id, type: "equal", value: "0" },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const amounts = (res.body as Array<{ amount: string }>).map(
        (a) => a.amount,
      );
      expect(amounts).toEqual(expect.arrayContaining(["50.00", "50.00"]));
    });

    it("sets shares allocations and calculates proportional amounts", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "90.00");
      const p1 = await makeParticipant(receipt.id, "Alice");
      const p2 = await makeParticipant(receipt.id, "Bob");

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [
            { participantId: p1.id, type: "shares", value: "2" },
            { participantId: p2.id, type: "shares", value: "1" },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const byParticipant: Record<string, string> = {};
      for (const a of res.body as Array<{
        participantId: string;
        amount: string;
      }>) {
        byParticipant[a.participantId] = a.amount;
      }

      expect(byParticipant[p1.id]).toBe("60.00"); // 90 * 2/3
      expect(byParticipant[p2.id]).toBe("30.00"); // 90 * 1/3
    });

    it("sets custom allocations with provided amounts", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p1 = await makeParticipant(receipt.id, "Alice");
      const p2 = await makeParticipant(receipt.id, "Bob");

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [
            { participantId: p1.id, type: "custom", value: "70.00" },
            { participantId: p2.id, type: "custom", value: "30.00" },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const byParticipant: Record<string, string> = {};
      for (const a of res.body as Array<{
        participantId: string;
        amount: string;
      }>) {
        byParticipant[a.participantId] = a.amount;
      }

      expect(byParticipant[p1.id]).toBe("70.00");
      expect(byParticipant[p2.id]).toBe("30.00");
    });

    it("is idempotent: repeated calls with same body yield same result", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p = await makeParticipant(receipt.id, "Alice");

      const body = {
        allocations: [{ participantId: p.id, type: "equal", value: "0" }],
      };

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send(body)
        .expect(200);

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send(body)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const idempotentList = res.body as Array<{ amount: string }>;
      expect(idempotentList).toHaveLength(1);
      expect(idempotentList[0]).toHaveProperty("amount", "100.00");

      const dbCount = await prisma.allocation.count({
        where: { receiptItemId: item.id },
      });
      expect(dbCount).toBe(1);
    });

    it("clears all allocations when sent an empty array", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p = await makeParticipant(receipt.id, "Alice");

      await makeAllocation(receipt.id, item.id, p.id, "equal", "0", "100.00");

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({ allocations: [] })
        .expect(200);

      expect(res.body).toEqual([]);

      const dbCount = await prisma.allocation.count({
        where: { receiptItemId: item.id },
      });
      expect(dbCount).toBe(0);
    });

    it("returns 404 if item not found", async () => {
      await request(app.getHttpServer())
        .put("/v1/items/item_missing/allocations")
        .send({ allocations: [] })
        .expect(404);
    });

    it("returns 404 if item belongs to another user", async () => {
      const receipt = await makeReceipt(OTHER_USER_ID);
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({ allocations: [] })
        .expect(404);
    });

    it("returns 422 when total shares is zero", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p = await makeParticipant(receipt.id, "Alice");

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [{ participantId: p.id, type: "shares", value: "0" }],
        })
        .expect(422);
    });

    it("returns 422 when custom amounts exceed item total", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p1 = await makeParticipant(receipt.id, "Alice");
      const p2 = await makeParticipant(receipt.id, "Bob");

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [
            { participantId: p1.id, type: "custom", value: "80.00" },
            { participantId: p2.id, type: "custom", value: "30.00" },
          ],
        })
        .expect(422);
    });

    it("returns 400 when allocations field is missing", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({})
        .expect(400);
    });

    it("returns 400 when a participantId appears more than once", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "100.00");
      const p = await makeParticipant(receipt.id, "Alice");

      await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [
            { participantId: p.id, type: "equal", value: "0" },
            { participantId: p.id, type: "equal", value: "0" },
          ],
        })
        .expect(400);
    });

    it("returned allocations include all required fields", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id, "50.00");
      const p = await makeParticipant(receipt.id, "Alice");

      const res = await request(app.getHttpServer())
        .put(`/v1/items/${item.id}/allocations`)
        .send({
          allocations: [{ participantId: p.id, type: "equal", value: "0" }],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const returnedList = res.body as Array<{
        id: string;
        participantId: string;
        receiptItemId: string;
        type: string;
        value: string;
        amount: string;
        createdAt: string;
      }>;
      expect(returnedList[0]).toHaveProperty("id");
      expect(returnedList[0].participantId).toBe(p.id);
      expect(returnedList[0].receiptItemId).toBe(item.id);
      expect(returnedList[0].type).toBe("equal");
      expect(returnedList[0].value).toBe("0.00");
      expect(returnedList[0].amount).toBe("50.00");
      expect(returnedList[0]).toHaveProperty("createdAt");
      expect(Number.isNaN(Date.parse(returnedList[0].createdAt))).toBe(false);
    });
  });
});
