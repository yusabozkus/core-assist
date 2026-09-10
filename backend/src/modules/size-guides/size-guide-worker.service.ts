import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SizeGuideStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from '../billing/billing-subscription.service';
import { BillingAccessRequiredException } from '../billing/billing.errors';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import { UnrecoverableError } from 'bullmq';
import { GeminiClientService } from '../ai/gemini-client.service';
import { DEFAULT_SIZE_GUIDE_MODEL } from './size-guide.constants';
import { SizeGuideImageService } from './size-guide-image.service';
import { formatNormalizedSizeGuide } from './size-guide-queue.service';

@Injectable()
export class SizeGuideWorkerService {
  private readonly logger = new Logger(SizeGuideWorkerService.name);
  private readonly model =
    process.env.GEMINI_SIZE_GUIDE_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_SIZE_GUIDE_MODEL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly images: SizeGuideImageService,
    private readonly gemini: GeminiClientService,
    private readonly billing: BillingSubscriptionService,
  ) {}

  async extract(sizeGuideId: string) {
    const guide = await this.prisma.productSizeGuide.findUnique({
      where: { id: sizeGuideId },
      select: {
        id: true,
        sourceUrl: true,
        status: true,
        product: { select: { title: true, category: true, storeId: true } },
      },
    });

    if (!guide || guide.status === SizeGuideStatus.READY) return;
    await this.prisma.productSizeGuide.update({
      where: { id: guide.id },
      data: { status: SizeGuideStatus.PROCESSING, failureReason: null },
    });

    try {
      await this.billing.assertStoreAccess(
        guide.product.storeId,
        BILLING_SYNC_STOPPED_MESSAGE,
      );
      const cached = await this.prisma.productSizeGuide.findFirst({
        where: {
          id: { not: guide.id },
          sourceUrl: guide.sourceUrl,
          status: SizeGuideStatus.READY,
          normalizedText: { not: null },
          structuredData: { not: Prisma.DbNull },
        },
        orderBy: { analyzedAt: 'desc' },
        select: {
          rawText: true,
          normalizedText: true,
          structuredData: true,
          confidence: true,
          analyzedAt: true,
        },
      });
      if (cached?.normalizedText && cached.structuredData) {
        await this.prisma.productSizeGuide.update({
          where: { id: guide.id },
          data: {
            status: SizeGuideStatus.READY,
            rawText: cached.rawText,
            normalizedText: cached.normalizedText,
            structuredData: cached.structuredData,
            confidence: cached.confidence,
            failureReason: null,
            analyzedAt: cached.analyzedAt ?? new Date(),
          },
        });
        return;
      }

      const image = await this.images.download(guide.sourceUrl);
      await this.billing.assertStoreAccess(
        guide.product.storeId,
        BILLING_SYNC_STOPPED_MESSAGE,
      );
      const extraction = await this.gemini.extractSizeGuide({
        model: this.model,
        imageBase64: image.bytes.toString('base64'),
        mimeType: image.mimeType,
        prompt: createExtractionPrompt(
          guide.product.title,
          guide.product.category,
        ),
      });
      const normalizedText = formatNormalizedSizeGuide(extraction);

      await this.prisma.productSizeGuide.update({
        where: { id: guide.id },
        data: {
          status: SizeGuideStatus.READY,
          rawText: extraction.rawText.slice(0, 20_000),
          normalizedText,
          structuredData: extraction,
          confidence: Math.max(0, Math.min(1, extraction.confidence)),
          failureReason: null,
          analyzedAt: new Date(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Beden tablosu analiz edilemedi.';
      await this.prisma.productSizeGuide.updateMany({
        where: { id: guide.id },
        data: {
          status: SizeGuideStatus.FAILED,
          failureReason: message.slice(0, 1_000),
        },
      });
      this.logger.warn(
        `${guide.id} beden tablosu analiz edilemedi: ${message}`,
      );
      if (error instanceof BillingAccessRequiredException)
        throw new UnrecoverableError(error.message);
      throw error;
    }
  }
}

function createExtractionPrompt(title: string, category: string | null) {
  return [
    'Bu görseldeki beden veya ölçü tablosunu eksiksiz ve yalnızca görünen verilere dayanarak yapılandır.',
    'Satır ve sütun değerlerini tahmin etme, yuvarlama veya dönüştürme.',
    'Bir hücre okunamıyorsa değeri boş bırak; beden tablosunda olmayan ölçüleri ekleme.',
    'Türkçe sütun adlarını görseldeki anlamı koruyarak yaz.',
    'headers alanına yalnızca ölçü sütunlarını yaz; beden, size veya numara sütununu ekleme.',
    'rawText alanına görselde okunabilen beden tablosu metnini düz metin olarak aktar.',
    `Ürün: ${title}`,
    `Kategori: ${category ?? 'Belirtilmemiş'}`,
  ].join('\n');
}
