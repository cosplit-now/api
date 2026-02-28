/**
 * Phase 3: Receipts E2E tests
 *
 * Endpoints covered:
 *   POST   /v1/receipts
 *   GET    /v1/receipts
 *   GET    /v1/receipts/:id
 *   PATCH  /v1/receipts/:id
 *   DELETE /v1/receipts/:id
 *   POST   /v1/receipts/:id/ocr
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 * BullMQ queue is mocked via overrideProviders.
 */

import { INestApplication } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { App } from "supertest/types";
import { vi } from "vitest";
import { ReceiptsModule } from "../src/receipts/receipts.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";

describe("/v1/receipts", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mockReceiptQueue: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    mockReceiptQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };

    app = await createTestApp(
      [
        BullModule.forRoot({
          connection: {
            host: process.env["REDIS_HOST"] ?? "localhost",
            port: Number(process.env["REDIS_PORT"] ?? "6379"),
          },
        }),
        ReceiptsModule,
      ],
      {
        overrideProviders: [
          {
            provide: getQueueToken("receipt"),
            useValue: mockReceiptQueue,
          },
        ],
      },
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    vi.clearAllMocks();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const makeAttachment = (overrides: Record<string, any> = {}) =>
    prisma.receiptAttachment.create({
      data: {
        key: `receipts/${TEST_USER.id}/img.jpg`,
        bucket: "test-bucket",
        url: "https://cdn.test/img.jpg",
        userId: TEST_USER.id,
        contentType: "image/jpeg",
        sizeBytes: 1000,
        originalName: "img.jpg",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        ...overrides,
      },
    });

  const makeReceipt = (overrides: Record<string, any> = {}) =>
    prisma.receipt.create({
      data: { userId: TEST_USER.id, ...overrides },
    });

  // ── POST /v1/receipts ─────────────────────────────────────────────────────

  describe("POST /v1/receipts", () => {
    it("returns 201 with full receipt detail", async () => {
      const att = await makeAttachment();

      const res = await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(201);

      const body100 = res.body as {
        id: string;
        userId: string;
        ocrStatus: string;
        items: unknown[];
        participants: unknown[];
        allocations: unknown[];
        createdAt: string;
        attachments: Array<{ id: string }>;
      };
      expect(typeof body100.id).toBe("string");
      expect(body100.userId).toBe(TEST_USER.id);
      expect(body100.ocrStatus).toBe("pending");
      expect(body100.items).toEqual([]);
      expect(body100.participants).toEqual([]);
      expect(body100.allocations).toEqual([]);
      expect(typeof body100.createdAt).toBe("string");
      expect(Array.isArray(body100.attachments)).toBe(true);
      expect(body100.attachments).toHaveLength(1);
      expect(body100.attachments[0].id).toBe(att.id);
      expect(Number.isNaN(Date.parse(body100.createdAt))).toBe(false);
    });

    it("marks attachment as attached in DB", async () => {
      const att = await makeAttachment();
      const res = await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(201);

      const updated = await prisma.receiptAttachment.findUnique({
        where: { id: att.id },
      });
      expect(res.body).toHaveProperty("id");
      const body122 = res.body as { id: string };
      expect(updated?.receiptId).toBe(body122.id);
      expect(updated?.status).toBe("attached");
    });

    it("enqueues a v1-ocr job", async () => {
      const att = await makeAttachment();
      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(201);

      const addCall = mockReceiptQueue.add.mock.calls[0] as [
        string,
        { receiptId: string },
        unknown,
      ];
      expect(addCall[0]).toBe("v1-ocr");
      expect(typeof addCall[1].receiptId).toBe("string");
    });

    it("returns 400 if attachmentIds is empty", async () => {
      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [] })
        .expect(400);
    });

    it("returns 400 if attachmentIds has duplicates", async () => {
      const att = await makeAttachment();
      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id, att.id] })
        .expect(400);
    });

    it("returns 404 if attachment does not exist", async () => {
      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: ["att_nonexistent"] })
        .expect(404);
    });

    it("returns 422 if attachment is already attached to another receipt", async () => {
      const receipt = await makeReceipt();
      const att = await makeAttachment({
        receiptId: receipt.id,
        status: "attached",
      });

      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(422);
    });

    it("returns 422 if attachment is expired", async () => {
      const att = await makeAttachment({
        status: "expired",
        expiresAt: new Date(Date.now() - 1000),
      });

      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(422);
    });
  });

  // ── GET /v1/receipts ──────────────────────────────────────────────────────

  describe("GET /v1/receipts", () => {
    it("returns 200 with paginated list in summary shape", async () => {
      const receipt = await makeReceipt({ storeName: "Costco" });
      await makeAttachment({ receiptId: receipt.id, status: "attached" });
      await makeReceipt(); // receipt without attachment

      const res = await request(app.getHttpServer())
        .get("/v1/receipts")
        .expect(200);

      const bodyData = res.body as {
        data: Array<{
          storeName: string | null;
          attachmentUrl: string | null;
          ocrStatus: string;
        }>;
        meta: { total: number; page: number; pageSize: number };
      };
      expect(Array.isArray(bodyData.data)).toBe(true);
      expect(bodyData.data).toHaveLength(2);
      expect(bodyData.meta).toMatchObject({ total: 2, page: 1, pageSize: 20 });

      // summary shape: only these fields
      const withAtt = bodyData.data.find((d) => d.storeName === "Costco");
      expect(withAtt).toHaveProperty("id");
      expect(withAtt).toHaveProperty("storeName", "Costco");
      expect(withAtt).toHaveProperty("ocrStatus", "pending");
      expect(withAtt).toHaveProperty(
        "attachmentUrl",
        "https://cdn.test/img.jpg",
      );
      expect(withAtt).toHaveProperty("createdAt");
      // no nested collections in list
      expect(withAtt).not.toHaveProperty("attachments");
      expect(withAtt).not.toHaveProperty("items");
      expect(withAtt).not.toHaveProperty("storeAddress");

      // receipt with no attachment has null attachmentUrl
      const withoutAtt = bodyData.data.find((d) => d.storeName === null);
      expect(withoutAtt).toHaveProperty("attachmentUrl", null);
    });

    it("filters by ocrStatus", async () => {
      await makeReceipt({ ocrStatus: "pending" });
      await makeReceipt({ ocrStatus: "completed" });

      const res = await request(app.getHttpServer())
        .get("/v1/receipts?ocrStatus=completed")
        .expect(200);

      const body244 = res.body as {
        data: Array<{ ocrStatus: string }>;
        meta: { total: number };
      };
      expect(body244.meta.total).toBe(1);
      expect(body244.data).toHaveLength(1);
      expect(body244.data[0]).toHaveProperty("ocrStatus", "completed");
    });

    it("respects pagination params", async () => {
      await makeReceipt();
      await makeReceipt();
      await makeReceipt();

      const res = await request(app.getHttpServer())
        .get("/v1/receipts?page=1&pageSize=2")
        .expect(200);

      const body260 = res.body as {
        data: unknown[];
        meta: { total: number; page: number; pageSize: number };
      };
      expect(body260.meta).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(body260.data).toHaveLength(2);
    });
  });

  // ── GET /v1/receipts/:id ──────────────────────────────────────────────────

  describe("GET /v1/receipts/:id", () => {
    it("returns 200 with full receipt detail", async () => {
      const receipt = await makeReceipt({ storeName: "Costco" });
      const att = await makeAttachment({
        receiptId: receipt.id,
        status: "attached",
      });

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}`)
        .expect(200);

      const body284 = res.body as { attachments: Array<{ id: string }> };
      expect(res.body).toHaveProperty("id", receipt.id);
      expect(res.body).toHaveProperty("storeName", "Costco");
      expect(res.body).toHaveProperty("userId", TEST_USER.id);
      expect(res.body).toHaveProperty("items", []);
      expect(res.body).toHaveProperty("participants", []);
      expect(res.body).toHaveProperty("allocations", []);
      expect(Array.isArray(body284.attachments)).toBe(true);
      expect(body284.attachments).toHaveLength(1);
      expect(body284.attachments[0].id).toBe(att.id);
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .get("/v1/receipts/rec_nonexistent")
        .expect(404);
    });

    it("returns 404 if receipt belongs to another user", async () => {
      const receipt = await prisma.receipt.create({
        data: { userId: "other-user-id" },
      });

      await request(app.getHttpServer())
        .get(`/v1/receipts/${receipt.id}`)
        .expect(404);
    });
  });

  // ── PATCH /v1/receipts/:id ────────────────────────────────────────────────

  describe("PATCH /v1/receipts/:id", () => {
    it("returns 200 and updates provided fields", async () => {
      const receipt = await makeReceipt();

      const res = await request(app.getHttpServer())
        .patch(`/v1/receipts/${receipt.id}`)
        .send({ storeName: "Target", storeAddress: "123 Main St" })
        .expect(200);

      expect(res.body).toMatchObject({
        storeName: "Target",
        storeAddress: "123 Main St",
      });
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .patch("/v1/receipts/rec_nonexistent")
        .send({ storeName: "Walmart" })
        .expect(404);
    });
  });

  // ── DELETE /v1/receipts/:id ───────────────────────────────────────────────

  describe("DELETE /v1/receipts/:id", () => {
    it("returns 204 and deletes the receipt", async () => {
      const receipt = await makeReceipt();

      await request(app.getHttpServer())
        .delete(`/v1/receipts/${receipt.id}`)
        .expect(204);

      const record = await prisma.receipt.findUnique({
        where: { id: receipt.id },
      });
      expect(record).toBeNull();
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .delete("/v1/receipts/rec_nonexistent")
        .expect(404);
    });
  });

  // ── POST /v1/receipts/:id/ocr ─────────────────────────────────────────────

  describe("POST /v1/receipts/:id/ocr", () => {
    it("returns 200 with processing status", async () => {
      const receipt = await makeReceipt({ ocrStatus: "failed" });

      const res = await request(app.getHttpServer())
        .post(`/v1/receipts/${receipt.id}/ocr`)
        .expect(200);

      expect(res.body).toEqual({ ocrStatus: "processing" });

      expect(mockReceiptQueue.add).toHaveBeenCalledWith(
        "v1-ocr",
        expect.objectContaining({ receiptId: receipt.id }),
        expect.anything(),
      );
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .post("/v1/receipts/rec_nonexistent/ocr")
        .expect(404);
    });

    it("returns 422 if receipt is not in failed state", async () => {
      for (const ocrStatus of ["pending", "processing", "completed"]) {
        const receipt = await makeReceipt({ ocrStatus });
        await request(app.getHttpServer())
          .post(`/v1/receipts/${receipt.id}/ocr`)
          .expect(422);
      }
    });
  });
});
