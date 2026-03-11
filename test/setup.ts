/**
 * Vitest globalSetup — runs once in the main process before all test files.
 *
 * Responsibilities:
 *  1. Load .env.test into process.env (propagates to all worker processes)
 *  2. Run `prisma migrate deploy` against the test database
 *  3. Upsert the shared test user (needed for FK constraints)
 */

import { execSync } from "child_process";
import { resolve } from "path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export async function setup() {
  // 1. Load test env vars — must happen before anything else
  config({ path: resolve(process.cwd(), ".env.test") });

  // 2. Apply all pending migrations to the test DB
  execSync("npx prisma migrate deploy", {
    env: { ...process.env },
    stdio: "inherit",
  });

  // 3. Seed the shared test user
  //    PrismaService uses @prisma/adapter-pg, so we mirror that here.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.user.upsert({
      where: { id: "test-user-id" },
      create: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: "other-user-id" },
      create: {
        id: "other-user-id",
        name: "Other User",
        email: "other@example.com",
        emailVerified: false,
      },
      update: {},
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  // Nothing to tear down — test DB persists between runs.
  // Individual test files clean their own data in beforeEach.
}
