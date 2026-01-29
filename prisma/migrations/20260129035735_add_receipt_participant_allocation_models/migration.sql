-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('equal', 'weight', 'custom', 'quantity');

-- CreateTable
CREATE TABLE "receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT,
    "storeAddress" TEXT,
    "receiptDate" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2),
    "discount" DECIMAL(14,2),
    "taxAmount" DECIMAL(14,2),
    "totalAmount" DECIMAL(14,2),
    "ocrResult" JSONB,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_attachment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "originalName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "receiptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2),
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rawData" JSONB,
    "receiptId" TEXT NOT NULL,

    CONSTRAINT "receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPayer" BOOLEAN NOT NULL DEFAULT false,
    "receiptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation" (
    "id" TEXT NOT NULL,
    "type" "AllocationType" NOT NULL,
    "participantId" TEXT NOT NULL,
    "receiptItemId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_userId_idx" ON "receipt"("userId");

-- CreateIndex
CREATE INDEX "receipt_attachment_receiptId_idx" ON "receipt_attachment"("receiptId");

-- CreateIndex
CREATE INDEX "receipt_item_receiptId_idx" ON "receipt_item"("receiptId");

-- CreateIndex
CREATE INDEX "participant_receiptId_idx" ON "participant"("receiptId");

-- CreateIndex
CREATE INDEX "allocation_receiptId_idx" ON "allocation"("receiptId");

-- CreateIndex
CREATE INDEX "allocation_participantId_idx" ON "allocation"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_participantId_receiptItemId_key" ON "allocation"("participantId", "receiptItemId");

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_attachment" ADD CONSTRAINT "receipt_attachment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_item" ADD CONSTRAINT "receipt_item_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant" ADD CONSTRAINT "participant_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "receipt_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
