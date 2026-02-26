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

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.userId).toBe(TEST_USER.id);
      expect(res.body.ocrStatus).toBe("pending");
      expect(Array.isArray(res.body.attachments)).toBe(true);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].id).toBe(att.id);
      expect(res.body.items).toEqual([]);
      expect(res.body.participants).toEqual([]);
      expect(res.body.allocations).toEqual([]);
      expect(Number.isNaN(Date.parse(res.body.createdAt))).toBe(false);
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
      expect(updated?.receiptId).toBe(res.body.id);
      expect(updated?.status).toBe("attached");
    });

    it("enqueues a v1-ocr job", async () => {
      const att = await makeAttachment();
      await request(app.getHttpServer())
        .post("/v1/receipts")
        .send({ attachmentIds: [att.id] })
        .expect(201);

      expect(mockReceiptQueue.add).toHaveBeenCalledWith(
        "v1-ocr",
        expect.objectContaining({ receiptId: expect.any(String) }),
        expect.any(Object),
      );
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

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ total: 2, page: 1, pageSize: 20 });

      // summary shape: only these fields
      const withAtt = res.body.data.find((d: any) => d.storeName === "Costco");
      expect(withAtt).toMatchObject({
        id: expect.any(String),
        storeName: "Costco",
        ocrStatus: "pending",
        attachmentUrl: "https://cdn.test/img.jpg",
        createdAt: expect.any(String),
      });
      // no nested collections in list
      expect(withAtt).not.toHaveProperty("attachments");
      expect(withAtt).not.toHaveProperty("items");
      expect(withAtt).not.toHaveProperty("storeAddress");

      // receipt with no attachment has null attachmentUrl
      const withoutAtt = res.body.data.find((d: any) => d.storeName === null);
      expect(withoutAtt.attachmentUrl).toBeNull();
    });

    it("filters by ocrStatus", async () => {
      await makeReceipt({ ocrStatus: "pending" });
      await makeReceipt({ ocrStatus: "completed" });

      const res = await request(app.getHttpServer())
        .get("/v1/receipts?ocrStatus=completed")
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].ocrStatus).toBe("completed");
      expect(res.body.meta.total).toBe(1);
    });

    it("respects pagination params", async () => {
      await makeReceipt();
      await makeReceipt();
      await makeReceipt();

      const res = await request(app.getHttpServer())
        .get("/v1/receipts?page=1&pageSize=2")
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ total: 3, page: 1, pageSize: 2 });
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

      expect(res.body.id).toBe(receipt.id);
      expect(res.body.storeName).toBe("Costco");
      expect(res.body.userId).toBe(TEST_USER.id);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].id).toBe(att.id);
      expect(res.body.items).toEqual([]);
      expect(res.body.participants).toEqual([]);
      expect(res.body.allocations).toEqual([]);
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

      expect(res.body.storeName).toBe("Target");
      expect(res.body.storeAddress).toBe("123 Main St");
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
        expect.any(Object),
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
