import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { extractReceiptItems } from "receipt-ocr";
import { PrismaService } from "src/prisma/prisma.service";
import { S3Service } from "src/s3/s3.service";

@Processor("receipt")
export class ReceiptQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(ReceiptQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  async process(
    job: Job<
      { receiptId: string; imageUrl?: string; imageKey?: string },
      any,
      string
    >,
  ): Promise<any> {
    if (job.name === "ocr") {
      const { receiptId } = job.data;
      this.logger.log(
        `[job:${job.id}] Starting OCR for demo receipt ${receiptId}`,
      );

      const receipt = await this.prisma.demoReceipt.findUnique({
        where: { id: receiptId },
      });
      if (!receipt) {
        this.logger.warn(
          `[job:${job.id}] Demo receipt ${receiptId} not found, skipping`,
        );
        return;
      }

      await this.prisma.demoReceipt.update({
        where: { id: receiptId },
        data: { status: "ocr_processing" },
      });

      const imageUrl = job.data.imageUrl;
      if (!imageUrl) {
        throw new Error("Missing image URL for demo OCR job");
      }

      try {
        const receiptItems = await extractReceiptItems(imageUrl);
        await this.prisma.demoReceipt.update({
          where: { id: receiptId },
          data: { status: "ocr_done", ocrResult: JSON.stringify(receiptItems) },
        });
        this.logger.log(
          `[job:${job.id}] OCR completed for demo receipt ${receiptId}`,
        );
      } catch (e) {
        this.logger.error(
          `[job:${job.id}] OCR failed for demo receipt ${receiptId}`,
          e instanceof Error ? e.stack : String(e),
        );
        await this.prisma.demoReceipt.update({
          where: { id: receiptId },
          data: { status: "ocr_failed" },
        });
        throw e;
      }
    } else if (job.name === "v1-ocr") {
      const { receiptId } = job.data;
      this.logger.log(`[job:${job.id}] Starting OCR for receipt ${receiptId}`);

      const receipt = await this.prisma.receipt.findUnique({
        where: { id: receiptId },
      });
      if (!receipt) {
        this.logger.warn(
          `[job:${job.id}] Receipt ${receiptId} not found, skipping`,
        );
        return;
      }

      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: "processing" },
      });

      const imageUrl =
        job.data.imageKey && !job.data.imageUrl
          ? await this.s3Service.getDownloadUrl(job.data.imageKey)
          : job.data.imageUrl;

      if (!imageUrl) {
        throw new Error("Missing image URL for OCR job");
      }

      try {
        const receiptItems = await extractReceiptItems(imageUrl);
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: {
            ocrStatus: "completed",
            ocrResult: JSON.stringify(receiptItems),
          },
        });
        this.logger.log(
          `[job:${job.id}] OCR completed for receipt ${receiptId}`,
        );
      } catch (e) {
        this.logger.error(
          `[job:${job.id}] OCR failed for receipt ${receiptId}`,
          e instanceof Error ? e.stack : String(e),
        );
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { ocrStatus: "failed" },
        });
        throw e;
      }
    }
  }
}
