import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { extractReceiptItems } from "receipt-ocr";
import { PrismaService } from "src/prisma/prisma.service";

@Processor("receipt")
export class ReceiptQueueProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(
    job: Job<{ receiptId: string; imageUrl: string }, any, string>,
  ): Promise<any> {
    if (job.name === "ocr") {
      const receipt = await this.prisma.demoReceipt.findUnique({
        where: { id: job.data.receiptId },
      });
      if (!receipt) return;

      await this.prisma.demoReceipt.update({
        where: { id: job.data.receiptId },
        data: { status: "ocr_processing" },
      });
      try {
        const receiptItems = await extractReceiptItems(job.data.imageUrl);
        await this.prisma.demoReceipt.update({
          where: { id: job.data.receiptId },
          data: { status: "ocr_done", ocrResult: JSON.stringify(receiptItems) },
        });
      } catch (e) {
        console.log("receipt ocr failed", e);
        await this.prisma.demoReceipt.update({
          where: { id: job.data.receiptId },
          data: { status: "ocr_failed" },
        });
        throw e;
      }
    } else if (job.name === "v1-ocr") {
      const receipt = await this.prisma.receipt.findUnique({
        where: { id: job.data.receiptId },
      });
      if (!receipt) return;

      await this.prisma.receipt.update({
        where: { id: job.data.receiptId },
        data: { ocrStatus: "processing" },
      });
      try {
        const receiptItems = await extractReceiptItems(job.data.imageUrl);
        await this.prisma.receipt.update({
          where: { id: job.data.receiptId },
          data: {
            ocrStatus: "completed",
            ocrResult: JSON.stringify(receiptItems),
          },
        });
      } catch (e) {
        console.log("v1 receipt ocr failed", e);
        await this.prisma.receipt.update({
          where: { id: job.data.receiptId },
          data: { ocrStatus: "failed" },
        });
        throw e;
      }
    }
  }
}
