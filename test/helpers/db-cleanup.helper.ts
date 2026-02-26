/**
 * Database cleanup helper for E2E tests.
 *
 * Deletes all application data in correct FK order before each test,
 * while preserving the shared test user created in globalSetup.
 *
 * Usage:
 *   import { cleanDatabase } from './helpers/db-cleanup.helper';
 *   beforeEach(() => cleanDatabase(prisma));
 */

import { PrismaService } from "../../src/prisma/prisma.service";

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Delete in reverse dependency order to satisfy FK constraints
  await prisma.$transaction([
    prisma.allocation.deleteMany(),
    prisma.participant.deleteMany(),
    prisma.receiptItem.deleteMany(),
    prisma.receiptAttachment.deleteMany(),
    prisma.receipt.deleteMany(),
    // DemoReceipt is independent of the v1 models
    prisma.demoReceipt.deleteMany(),
    // User is intentionally preserved (test-user-id must persist)
  ]);
}
