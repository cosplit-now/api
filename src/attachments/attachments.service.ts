import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../s3/s3.service";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

export interface AttachmentResponse {
  id: string;
  key: string;
  bucket: string;
  contentType: string | null;
  sizeBytes: number | null;
  originalName: string | null;
  sortOrder: number;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const EXPIRES_IN_SECONDS = 3600;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async createAttachment(
    dto: CreateAttachmentDto,
    userId: string,
  ): Promise<AttachmentResponse> {
    const keyPrefix = `receipts/${userId}/`;
    if (!dto.key.startsWith(keyPrefix)) {
      throw new ForbiddenException("Attachment key is not owned by user");
    }

    const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000);
    const attachment = await this.prisma.receiptAttachment.create({
      data: {
        key: dto.key,
        bucket: dto.bucket,
        url: this.s3Service.getPublicUrl(dto.key),
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        originalName: dto.originalName,
        sortOrder: dto.sortOrder ?? 0,
        notes: dto.notes ?? null,
        expiresAt,
        userId,
      },
    });

    return {
      id: attachment.id,
      key: attachment.key,
      bucket: attachment.bucket,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      originalName: attachment.originalName,
      sortOrder: attachment.sortOrder,
      notes: attachment.notes,
      expiresAt: attachment.expiresAt?.toISOString() ?? null,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  async deleteAttachment(id: string, userId: string): Promise<void> {
    const attachment = await this.prisma.receiptAttachment.findUnique({
      where: { id },
    });

    if (!attachment || attachment.userId !== userId) {
      throw new NotFoundException("Attachment not found");
    }

    if (attachment.receiptId) {
      throw new UnprocessableEntityException(
        "Attachment is already attached to a receipt",
      );
    }

    const key = attachment.key;
    await this.prisma.receiptAttachment.delete({ where: { id } });
    try {
      await this.s3Service.deleteImage(key);
    } catch {
      // Best-effort cleanup; storage errors should not block deletion.
    }
  }
}
