import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AttachmentsModule } from "../src/attachments/attachments.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { S3Service } from "../src/s3/s3.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";

const MOCK_PUBLIC_BASE_URL = "https://test-r2.example.com";

function buildMockS3Service() {
  return {
    getSignedUrl: vi
      .fn()
      .mockResolvedValue("https://mock-r2.example.com/presigned"),
    getPublicUrl: vi
      .fn()
      .mockImplementation((key: string) => `${MOCK_PUBLIC_BASE_URL}/${key}`),
    getDownloadUrl: vi
      .fn()
      .mockResolvedValue("https://mock-r2.example.com/download"),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
    bucket: "test-bucket",
  };
}

describe("/v1/attachments", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([AttachmentsModule], {
      overrideProviders: [
        { provide: S3Service, useValue: buildMockS3Service() },
      ],
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe("POST /v1/attachments", () => {
    const payload = {
      key: "receipts/test-user-id/image1.jpg",
      bucket: "test-bucket",
      contentType: "image/jpeg",
      sizeBytes: 1234567,
      originalName: "IMG_1234.jpg",
    };

    it("returns 201 with attachment fields and defaults", async () => {
      const before = Date.now();
      const res = await request(app.getHttpServer())
        .post("/v1/attachments")
        .send(payload)
        .expect(201);
      const after = Date.now();

      expect(res.body).toMatchObject({
        key: payload.key,
        bucket: payload.bucket,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        originalName: payload.originalName,
        sortOrder: 0,
        notes: null,
      });
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("expiresAt");
      expect(res.body).toHaveProperty("createdAt");
      const body = res.body as {
        id: string;
        expiresAt: string;
        createdAt: string;
      };
      const expiresAt = new Date(body.expiresAt).getTime();
      const ONE_HOUR_MS = 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(before + ONE_HOUR_MS - 5_000);
      expect(expiresAt).toBeLessThanOrEqual(after + ONE_HOUR_MS + 5_000);
      expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);

      const record = await prisma.receiptAttachment.findUnique({
        where: { id: body.id },
      });
      expect(record?.userId).toBe(TEST_USER.id);
    });

    it("returns 400 if key is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          bucket: payload.bucket,
          contentType: payload.contentType,
          sizeBytes: payload.sizeBytes,
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 400 if bucket is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: payload.key,
          contentType: payload.contentType,
          sizeBytes: payload.sizeBytes,
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 400 if contentType is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: payload.key,
          bucket: payload.bucket,
          sizeBytes: payload.sizeBytes,
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 400 if sizeBytes is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: payload.key,
          bucket: payload.bucket,
          contentType: payload.contentType,
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 400 if originalName is missing", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: payload.key,
          bucket: payload.bucket,
          contentType: payload.contentType,
          sizeBytes: payload.sizeBytes,
        })
        .expect(400);
    });

    it("returns 400 if key is an empty string", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: "",
          bucket: payload.bucket,
          contentType: payload.contentType,
          sizeBytes: payload.sizeBytes,
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 400 if sizeBytes is not a number", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          key: payload.key,
          bucket: payload.bucket,
          contentType: payload.contentType,
          sizeBytes: "big",
          originalName: payload.originalName,
        })
        .expect(400);
    });

    it("returns 403 if key is not scoped to the current user", async () => {
      await request(app.getHttpServer())
        .post("/v1/attachments")
        .send({
          ...payload,
          key: "receipts/other-user/image1.jpg",
        })
        .expect(403);
    });
  });

  describe("DELETE /v1/attachments/:id", () => {
    const baseAttachment = {
      key: "receipts/test-user-id/to-delete.jpg",
      bucket: "test-bucket",
      url: "https://test-r2.example.com/receipts/test-user-id/to-delete.jpg",
      userId: TEST_USER.id,
      contentType: "image/jpeg",
      sizeBytes: 100,
      originalName: "to-delete.jpg",
    };

    it("returns 204 and deletes unattached attachment", async () => {
      const attachment = await prisma.receiptAttachment.create({
        data: baseAttachment,
      });

      await request(app.getHttpServer())
        .delete(`/v1/attachments/${attachment.id}`)
        .expect(204);

      const record = await prisma.receiptAttachment.findUnique({
        where: { id: attachment.id },
      });
      expect(record).toBeNull();
    });

    it("returns 404 if attachment does not exist", async () => {
      await request(app.getHttpServer())
        .delete("/v1/attachments/att_missing")
        .expect(404);
    });

    it("returns 422 if attachment is already attached to a receipt", async () => {
      const receipt = await prisma.receipt.create({
        data: { userId: TEST_USER.id },
      });
      const attachment = await prisma.receiptAttachment.create({
        data: {
          ...baseAttachment,
          key: "receipts/test-user-id/attached.jpg",
          url: "https://test-r2.example.com/receipts/test-user-id/attached.jpg",
          receiptId: receipt.id,
        },
      });

      await request(app.getHttpServer())
        .delete(`/v1/attachments/${attachment.id}`)
        .expect(422);
    });
  });
});
