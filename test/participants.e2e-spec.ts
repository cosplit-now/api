/**
 * Phase 5: Participants E2E tests
 *
 * Endpoints covered:
 *   GET    /v1/participants
 *   GET    /v1/receipts/:receiptId/participants
 *   POST   /v1/receipts/:receiptId/participants
 *   PATCH  /v1/participants/:id
 *   DELETE /v1/participants/:id
 *
 * Auth: createTestApp injects TEST_USER via middleware (Option B — no 401 tests).
 */

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ParticipantsModule } from "../src/participants/participants.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TEST_USER } from "./helpers/auth.helper";
import { createTestApp } from "./helpers/create-app.helper";
import { cleanDatabase } from "./helpers/db-cleanup.helper";
import { App } from "supertest/types";

const OTHER_USER_ID = "other-user-id";

describe("/v1/participants", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([ParticipantsModule]);
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

  const makeParticipant = (receiptId: string, name: string) =>
    prisma.participant.create({ data: { receiptId, name } });

  // ── GET /v1/participants ─────────────────────────────────────────────────

  describe("GET /v1/participants", () => {
    it("returns paginated list of current user participants", async () => {
      const r1 = await makeReceipt();
      const r2 = await makeReceipt();
      const rOther = await makeReceipt(OTHER_USER_ID);

      await makeParticipant(r1.id, "Alice");
      await makeParticipant(r2.id, "Bob");
      await makeParticipant(rOther.id, "Charlie"); // belongs to other user

      const res = await request(app.getHttpServer())
        .get("/v1/participants")
        .expect(200);

      const body66 = res.body as {
        meta: { total: number };
        data: Array<{ name: string }>;
      };
      expect(body66.meta.total).toBe(2);
      expect(Array.isArray(body66.data)).toBe(true);
      expect(body66.data).toHaveLength(2);
      const names = body66.data.map((p) => p.name);
      expect(names).toEqual(expect.arrayContaining(["Alice", "Bob"]));
      expect(names).not.toContain("Charlie");
    });

    it("each participant has id, name, createdAt", async () => {
      const r = await makeReceipt();
      await makeParticipant(r.id, "Alice");

      const res = await request(app.getHttpServer())
        .get("/v1/participants")
        .expect(200);

      const body85 = res.body as {
        data: Array<{ id: string; name: string; createdAt: string }>;
      };
      expect(Array.isArray(body85.data)).toBe(true);
      expect(body85.data[0]).toHaveProperty("id");
      expect(body85.data[0]).toHaveProperty("name", "Alice");
      expect(body85.data[0]).toHaveProperty("createdAt");
      expect(body85.data[0]).not.toHaveProperty("receiptId");
      expect(body85.data[0]).not.toHaveProperty("isPayer");
      expect(Number.isNaN(Date.parse(body85.data[0].createdAt))).toBe(false);
    });

    it("returns empty list when user has no participants", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/participants")
        .expect(200);

      const body97 = res.body as { data: unknown[]; meta: { total: number } };
      expect(body97.data).toEqual([]);
      expect(body97.meta.total).toBe(0);
    });

    it("filters by search (case-insensitive fuzzy match)", async () => {
      const r = await makeReceipt();
      await makeParticipant(r.id, "Alice");
      await makeParticipant(r.id, "Bob");
      await makeParticipant(r.id, "Alice Smith");

      const res = await request(app.getHttpServer())
        .get("/v1/participants?search=alice")
        .expect(200);

      const body109 = res.body as {
        meta: { total: number };
        data: Array<{ name: string }>;
      };
      expect(body109.meta.total).toBe(2);
      expect(Array.isArray(body109.data)).toBe(true);
      const names = body109.data.map((p) => p.name);
      expect(names).toEqual(expect.arrayContaining(["Alice", "Alice Smith"]));
      expect(names).not.toContain("Bob");
    });

    it("respects pagination params", async () => {
      const r = await makeReceipt();
      await makeParticipant(r.id, "P1");
      await makeParticipant(r.id, "P2");
      await makeParticipant(r.id, "P3");

      const res = await request(app.getHttpServer())
        .get("/v1/participants?page=2&pageSize=2")
        .expect(200);

      const body127 = res.body as {
        meta: { total: number; page: number; pageSize: number };
        data: unknown[];
      };
      expect(body127.meta.total).toBe(3);
      expect(body127.meta.page).toBe(2);
      expect(body127.meta.pageSize).toBe(2);
      expect(body127.data).toHaveLength(1);
    });
  });

  // ── GET /v1/receipts/:receiptId/participants ─────────────────────────────

  describe("GET /v1/receipts/:receiptId/participants", () => {
    it("returns participants for the receipt", async () => {
      const r = await makeReceipt();
      const rOther = await makeReceipt();

      await makeParticipant(r.id, "Alice");
      await makeParticipant(r.id, "Bob");
      await makeParticipant(rOther.id, "Charlie");

      const res = await request(app.getHttpServer())
        .get(`/v1/receipts/${r.id}/participants`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      const names = (res.body as Array<{ name: string }>).map((p) => p.name);
      expect(names).toEqual(expect.arrayContaining(["Alice", "Bob"]));
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .get("/v1/receipts/rec_missing/participants")
        .expect(404);
    });

    it("returns 404 if receipt belongs to another user", async () => {
      const r = await makeReceipt(OTHER_USER_ID);

      await request(app.getHttpServer())
        .get(`/v1/receipts/${r.id}/participants`)
        .expect(404);
    });
  });

  // ── POST /v1/receipts/:receiptId/participants ────────────────────────────

  describe("POST /v1/receipts/:receiptId/participants", () => {
    it("creates a new participant by name", async () => {
      const r = await makeReceipt();

      const res = await request(app.getHttpServer())
        .post(`/v1/receipts/${r.id}/participants`)
        .send({ name: "Charlie" })
        .expect(201);

      const body185 = res.body as {
        id: string;
        name: string;
        createdAt: string;
      };
      expect(res.body).toHaveProperty("id");
      expect(body185.name).toBe("Charlie");
      expect(res.body).toHaveProperty("createdAt");
      expect(res.body).not.toHaveProperty("receiptId");
      expect(res.body).not.toHaveProperty("isPayer");
      expect(Number.isNaN(Date.parse(body185.createdAt))).toBe(false);

      const record = await prisma.participant.findUnique({
        where: { id: body185.id },
      });
      expect(record?.receiptId).toBe(r.id);
    });

    it("attaches an existing participant by participantId", async () => {
      const r1 = await makeReceipt();
      const r2 = await makeReceipt();
      const existing = await makeParticipant(r1.id, "Alice");

      const res = await request(app.getHttpServer())
        .post(`/v1/receipts/${r2.id}/participants`)
        .send({ participantId: existing.id })
        .expect(201);

      expect(res.body).toHaveProperty("name", "Alice");
      expect(res.body).toHaveProperty("id");
      const body201 = res.body as { id: string };

      const record = await prisma.participant.findUnique({
        where: { id: body201.id },
      });
      expect(record?.receiptId).toBe(r2.id);
    });

    it("returns 400 when both name and participantId are provided", async () => {
      const r = await makeReceipt();

      await request(app.getHttpServer())
        .post(`/v1/receipts/${r.id}/participants`)
        .send({ name: "Alice", participantId: "part_xxx" })
        .expect(400);
    });

    it("returns 400 when neither name nor participantId is provided", async () => {
      const r = await makeReceipt();

      await request(app.getHttpServer())
        .post(`/v1/receipts/${r.id}/participants`)
        .send({})
        .expect(400);
    });

    it("returns 404 if receipt not found", async () => {
      await request(app.getHttpServer())
        .post("/v1/receipts/rec_missing/participants")
        .send({ name: "Alice" })
        .expect(404);
    });

    it("returns 404 if receipt belongs to another user", async () => {
      const r = await makeReceipt(OTHER_USER_ID);

      await request(app.getHttpServer())
        .post(`/v1/receipts/${r.id}/participants`)
        .send({ name: "Alice" })
        .expect(404);
    });

    it("returns 404 if participantId does not belong to current user", async () => {
      const r = await makeReceipt();
      const rOther = await makeReceipt(OTHER_USER_ID);
      const otherParticipant = await makeParticipant(rOther.id, "Alice");

      await request(app.getHttpServer())
        .post(`/v1/receipts/${r.id}/participants`)
        .send({ participantId: otherParticipant.id })
        .expect(404);
    });
  });

  // ── PATCH /v1/participants/:id ───────────────────────────────────────────

  describe("PATCH /v1/participants/:id", () => {
    it("updates participant name and returns updated participant", async () => {
      const r = await makeReceipt();
      const p = await makeParticipant(r.id, "Alice");

      const res = await request(app.getHttpServer())
        .patch(`/v1/participants/${p.id}`)
        .send({ name: "Alicia" })
        .expect(200);

      expect(res.body).toMatchObject({ id: p.id, name: "Alicia" });
      expect(res.body).not.toHaveProperty("receiptId");
    });

    it("returns 400 when name is empty", async () => {
      const r = await makeReceipt();
      const p = await makeParticipant(r.id, "Alice");

      await request(app.getHttpServer())
        .patch(`/v1/participants/${p.id}`)
        .send({ name: "" })
        .expect(400);
    });

    it("returns 404 when participant not found", async () => {
      await request(app.getHttpServer())
        .patch("/v1/participants/part_missing")
        .send({ name: "New Name" })
        .expect(404);
    });

    it("returns 404 when participant belongs to another user", async () => {
      const r = await makeReceipt(OTHER_USER_ID);
      const p = await makeParticipant(r.id, "Alice");

      await request(app.getHttpServer())
        .patch(`/v1/participants/${p.id}`)
        .send({ name: "New Name" })
        .expect(404);
    });
  });

  // ── DELETE /v1/participants/:id ──────────────────────────────────────────

  describe("DELETE /v1/participants/:id", () => {
    it("deletes a participant", async () => {
      const r = await makeReceipt();
      const p = await makeParticipant(r.id, "Alice");

      await request(app.getHttpServer())
        .delete(`/v1/participants/${p.id}`)
        .expect(204);

      const record = await prisma.participant.findUnique({
        where: { id: p.id },
      });
      expect(record).toBeNull();
    });

    it("returns 404 when participant not found", async () => {
      await request(app.getHttpServer())
        .delete("/v1/participants/part_missing")
        .expect(404);
    });

    it("returns 404 when participant belongs to another user", async () => {
      const r = await makeReceipt(OTHER_USER_ID);
      const p = await makeParticipant(r.id, "Alice");

      await request(app.getHttpServer())
        .delete(`/v1/participants/${p.id}`)
        .expect(404);
    });
  });
});
