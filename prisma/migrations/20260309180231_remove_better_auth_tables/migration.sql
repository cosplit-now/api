/*
  Warnings:

  - You are about to drop the column `isAnonymous` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DemoReceipt" DROP CONSTRAINT "DemoReceipt_userId_fkey";

-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- AlterTable
ALTER TABLE "DemoReceipt" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "isAnonymous";

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "session";

-- DropTable
DROP TABLE "verification";

-- AddForeignKey
ALTER TABLE "DemoReceipt" ADD CONSTRAINT "DemoReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
