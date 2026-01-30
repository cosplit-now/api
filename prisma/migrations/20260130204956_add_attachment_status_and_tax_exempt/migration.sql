/*
  Warnings:

  - The values [weight,quantity] on the enum `AllocationType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `userId` to the `receipt_attachment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('pending', 'attached', 'expired');

-- AlterEnum
BEGIN;
CREATE TYPE "AllocationType_new" AS ENUM ('equal', 'shares', 'custom');
ALTER TABLE "allocation" ALTER COLUMN "type" TYPE "AllocationType_new" USING ("type"::text::"AllocationType_new");
ALTER TYPE "AllocationType" RENAME TO "AllocationType_old";
ALTER TYPE "AllocationType_new" RENAME TO "AllocationType";
DROP TYPE "public"."AllocationType_old";
COMMIT;

-- AlterTable
ALTER TABLE "receipt_attachment" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "status" "AttachmentStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "receiptId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "receipt_item" ADD COLUMN     "taxExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "receipt_attachment_userId_idx" ON "receipt_attachment"("userId");

-- AddForeignKey
ALTER TABLE "receipt_attachment" ADD CONSTRAINT "receipt_attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
