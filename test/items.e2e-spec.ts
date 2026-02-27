/**
 * Phase 4: Items E2E tests
 *
 * Endpoints covered:
 *   GET    /v1/receipts/:receiptId/items
 *   POST   /v1/receipts/:receiptId/items
 *   PATCH  /v1/items/:id
 *   DELETE /v1/items/:id
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 */

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ItemsModule } from "../src/items/items.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";
import { App } from "supertest/types";

const OTHER_USER_ID = "other-user-id";

describe("/v1/receipts/:receiptId/items", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([ItemsModule]);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const makeReceipt = (overrides: Record<string, any> = {}) =>
    prisma.receipt.create({
      data: {
        userId: TEST_USER.id,
        ...overrides,
      },
    });

  const makeItem = (receiptId: string, overrides: Record<string, any> = {}) =>
    prisma.receiptItem.create({
      data: {
        receiptId,
        name: "Sample Item",
        quantity: 1,
        unitPrice: "9.99",
        totalPrice: "9.99",
        discount: "0",
        description: "Sample description",
        category: "Sample category",
        taxExempt: false,
        sortOrder: 0,
        ...overrides,
      },
    });

  // ── GET /v1/receipts/:receiptId/items ─────────────────────────────────────

  describe("GET /v1/receipts/:receiptId/items", () => {
    it("returns 200 with items for the receipt", async () => {
      const receipt = await makeReceipt();
      const otherReceipt = await makeReceipt({ userId: OTHER_USER_ID });

      await makeItem(receipt.id, { name: "Apples", sortOrder: 1 });
      await makeItem(receipt.id, { name: "Bananas", sortOrder: 0 });
      await makeItem(otherReceipt.id, { name: "Other" });

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/items`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const names = res.body.map((item: any) => item.name);
      expect(names).toEqual(expect.arrayContaining(["Apples", "Bananas"]));
    });

    it("returns 404 if receipt is not found", async () => {
      await request(app.getHttpServer())
        .get("/v1/receipts/rec_missing/items")
        .expect(404);
    });

    it("returns 404 if receipt belongs to another user", async () => {
      const receipt = await makeReceipt({ userId: OTHER_USER_ID });

      await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}/items`)
        .expect(404);
    });
  });

  // ── POST /v1/receipts/:receiptId/items ────────────────────────────────────

  describe("POST /v1/receipts/:receiptId/items", () => {
    it("creates an item and returns it", async () => {
      const receipt = await makeReceipt();
      const payload = {
        name: "iPhone 15",
        quantity: 1,
        unitPrice: "999.99",
        totalPrice: "999.99",
        discount: "0",
        description: "256GB",
        category: "Electronics",
        taxExempt: false,
        sortOrder: 0,
      };
      const expected = { ...payload, discount: "0.00" };

      const res = await request(app.getHttpServer())
        .post(`/v1/receipts/${receipt.id}/items`)
        .send(payload)
        .expect(201);

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body).toMatchObject(expected);

      const record = await prisma.receiptItem.findUnique({
        where: { id: res.body.id },
      });
      expect(record?.receiptId).toBe(receipt.id);
    });

    it("returns 400 when name is missing", async () => {
      const receipt = await makeReceipt();

      await request(app.getHttpServer())
        .post(`/v1/receipts/${receipt.id}/items`)
        .send({
          quantity: 1,
          unitPrice: "9.99",
          totalPrice: "9.99",
        })
        .expect(400);
    });

    it("returns 400 when quantity is invalid", async () => {
      const receipt = await makeReceipt();

      await request(app.getHttpServer())
        .post(`/v1/receipts/${receipt.id}/items`)
        .send({
          name: "Invalid",
          quantity: 0,
          unitPrice: "9.99",
          totalPrice: "9.99",
        })
        .expect(400);
    });

    it("returns 404 when receipt is not found", async () => {
      await request(app.getHttpServer())
        .post("/v1/receipts/rec_missing/items")
        .send({
          name: "Missing receipt",
          quantity: 1,
          unitPrice: "9.99",
          totalPrice: "9.99",
        })
        .expect(404);
    });
  });

  // ── PATCH /v1/items/:id ───────────────────────────────────────────────────

  describe("PATCH /v1/items/:id", () => {
    it("updates an item and returns it", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id);

      const res = await request(app.getHttpServer())
        .patch(`/v1/items/${item.id}`)
        .send({
          name: "Updated",
          quantity: 2,
          unitPrice: "12.50",
          totalPrice: "25.00",
          discount: "1.00",
          taxExempt: true,
          sortOrder: 1,
        })
        .expect(200);

      expect(res.body.id).toBe(item.id);
      expect(res.body.name).toBe("Updated");
      expect(res.body.quantity).toBe(2);
      expect(res.body.unitPrice).toBe("12.50");
      expect(res.body.totalPrice).toBe("25.00");
      expect(res.body.discount).toBe("1.00");
      expect(res.body.taxExempt).toBe(true);
      expect(res.body.sortOrder).toBe(1);
    });

    it("returns 400 when quantity is invalid", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .patch(`/v1/items/${item.id}`)
        .send({ quantity: 0 })
        .expect(400);
    });

    it("returns 404 when item is not found", async () => {
      await request(app.getHttpServer())
        .patch("/v1/items/item_missing")
        .send({ name: "Missing" })
        .expect(404);
    });

    it("returns 404 when item belongs to another user", async () => {
      const receipt = await makeReceipt({ userId: OTHER_USER_ID });
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .patch(`/v1/items/${item.id}`)
        .send({ name: "No access" })
        .expect(404);
    });
  });

  // ── DELETE /v1/items/:id ──────────────────────────────────────────────────

  describe("DELETE /v1/items/:id", () => {
    it("deletes an item", async () => {
      const receipt = await makeReceipt();
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.id}`)
        .expect(204);

      const record = await prisma.receiptItem.findUnique({
        where: { id: item.id },
      });
      expect(record).toBeNull();
    });

    it("returns 404 when item is not found", async () => {
      await request(app.getHttpServer())
        .delete("/v1/items/item_missing")
        .expect(404);
    });

    it("returns 404 when item belongs to another user", async () => {
      const receipt = await makeReceipt({ userId: OTHER_USER_ID });
      const item = await makeItem(receipt.id);

      await request(app.getHttpServer())
        .delete(`/v1/items/${item.id}`)
        .expect(404);
    });
  });
});
