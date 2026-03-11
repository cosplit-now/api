/**
 * E2E tests for POST /v1/uploads/presigned-url
 *
 * This endpoint:
 *   1. Accepts file metadata (filename, contentType, sizeBytes)
 *   2. Generates a unique object key
 *   3. Asks S3Service for a presigned PUT URL
 *   4. Returns the URL + key + bucket + expiry so the client can upload directly
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 * S3Service: replaced with a vi.fn() mock — no real R2 calls are made.
 * Database: not used by this endpoint.
 */

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { createTestApp } from "./helpers/create-app.helper";
import { TEST_USER } from "./helpers/auth.helper";
import { UploadsModule } from "../src/uploads/uploads.module";
import { S3Service } from "../src/s3/s3.service";

// ---------------------------------------------------------------------------
// Shared mock setup
// ---------------------------------------------------------------------------

const MOCK_SIGNED_URL = "https://mock-r2.example.com/presigned-upload-url";
const MOCK_BUCKET = "test-bucket";

function buildMockS3Service() {
  return {
    getSignedUrl: vi.fn().mockResolvedValue(MOCK_SIGNED_URL),
    getPublicUrl: vi.fn().mockReturnValue("https://mock-r2.example.com/file"),
    getDownloadUrl: vi
      .fn()
      .mockResolvedValue("https://mock-r2.example.com/download"),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
    // Expose bucket so UploadsService can include it in the response
    bucket: MOCK_BUCKET,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("POST /v1/uploads/presigned-url", () => {
  let app: INestApplication<App>;
  let mockS3: ReturnType<typeof buildMockS3Service>;

  beforeAll(async () => {
    mockS3 = buildMockS3Service();

    app = await createTestApp([UploadsModule], {
      overrideProviders: [{ provide: S3Service, useValue: mockS3 }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset call counts between tests so assertions stay independent
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("returns 200 with uploadUrl, key, bucket, and expiresAt", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({
        filename: "receipt.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1_234_567,
      })
      .expect(200);

    expect(res.body).toHaveProperty("uploadUrl");
    expect(res.body).toHaveProperty("key");
    expect(res.body).toHaveProperty("bucket");
    expect(res.body).toHaveProperty("expiresAt");
  });

  it("uploadUrl is the presigned URL returned by S3Service", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({
        filename: "receipt.jpg",
        contentType: "image/jpeg",
        sizeBytes: 500,
      })
      .expect(200);

    expect(res.body).toHaveProperty("uploadUrl");
    const body101 = res.body as { uploadUrl: string };
    expect(body101.uploadUrl).toBe(MOCK_SIGNED_URL);
  });

  it("key is scoped under receipts/ and contains the original filename", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({
        filename: "IMG_1234.jpg",
        contentType: "image/jpeg",
        sizeBytes: 800,
      })
      .expect(200);

    expect(res.body).toHaveProperty("key");
    const body114 = res.body as { key: string };
    expect(body114.key).toMatch(/^receipts\//);
    expect(body114.key).toContain("IMG_1234.jpg");
  });

  it("key is scoped under the current user's ID", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "photo.png", contentType: "image/png", sizeBytes: 200 })
      .expect(200);

    // The key should contain the test user's ID injected by createTestApp
    expect(res.body).toHaveProperty("key");
    const body125 = res.body as { key: string };
    expect(body125.key).toContain(TEST_USER.id);
  });

  it("bucket matches the configured R2 bucket", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({
        filename: "scan.pdf",
        contentType: "application/pdf",
        sizeBytes: 99,
      })
      .expect(200);

    expect(res.body).toHaveProperty("bucket");
    const body138 = res.body as { bucket: string };
    expect(body138.bucket).toBe(MOCK_BUCKET);
  });

  it("expiresAt is an ISO 8601 date string roughly 1 hour in the future", async () => {
    const before = Date.now();

    const res = await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "r.jpg", contentType: "image/jpeg", sizeBytes: 1 })
      .expect(200);

    const after = Date.now();
    expect(res.body).toHaveProperty("expiresAt");
    const body150 = res.body as { expiresAt: string };
    const expiresAt = new Date(body150.expiresAt).getTime();

    // expiresAt should be between (before + ~1h) and (after + ~1h + buffer)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + ONE_HOUR_MS - 5_000);
    expect(expiresAt).toBeLessThanOrEqual(after + ONE_HOUR_MS + 5_000);
  });

  it("calls S3Service.getSignedUrl with the generated key", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "check.jpg", contentType: "image/jpeg", sizeBytes: 50 })
      .expect(200);

    expect(mockS3.getSignedUrl).toHaveBeenCalledOnce();
    const [calledKey] = mockS3.getSignedUrl.mock.calls[0] as [string];
    expect(calledKey).toContain("check.jpg");
  });

  // -------------------------------------------------------------------------
  // Validation errors (400)
  // -------------------------------------------------------------------------

  it("returns 400 if filename is missing", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ contentType: "image/jpeg", sizeBytes: 100 })
      .expect(400);
  });

  it("returns 400 if contentType is missing", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "receipt.jpg", sizeBytes: 100 })
      .expect(400);
  });

  it("returns 400 if sizeBytes is missing", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "receipt.jpg", contentType: "image/jpeg" })
      .expect(400);
  });

  it("returns 400 if filename is an empty string", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "", contentType: "image/jpeg", sizeBytes: 100 })
      .expect(400);
  });

  it("returns 400 if sizeBytes is not a number", async () => {
    await request(app.getHttpServer())
      .post("/v1/uploads/presigned-url")
      .send({ filename: "r.jpg", contentType: "image/jpeg", sizeBytes: "big" })
      .expect(400);
  });
});
