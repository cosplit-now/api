-- CreateEnum
CREATE TYPE "DemoReceiptStatus" AS ENUM ('uploaded', 'ocr_processing', 'ocr_done', 'ocr_failed', 'confirmed');

-- CreateTable
CREATE TABLE "DemoReceipt" (
    "id" TEXT NOT NULL,
    "status" "DemoReceiptStatus" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "ocrResult" JSONB,
    "finalResult" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoReceipt_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DemoReceipt" ADD CONSTRAINT "DemoReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
