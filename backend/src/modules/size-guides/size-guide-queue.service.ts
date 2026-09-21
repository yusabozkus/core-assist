import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Prisma } from '../../generated/prisma/client';
import { SizeGuideStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { BILLING_SYNC_STOPPED_MESSAGE } from '../billing/billing-access.policy';
import {
  EXTRACT_SIZE_GUIDE_JOB,
  SIZE_GUIDE_QUEUE,
} from './size-guide.constants';
import type {
  RegisterSizeGuideInput,
  SizeGuideExtractionJobData,
} from './size-guide.types';
import { SizeGuideDispatcher } from './size-guide.types';

@Injectable()
export class SizeGuideQueueService extends SizeGuideDispatcher {
  private readonly logger = new Logger(SizeGuideQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SIZE_GUIDE_QUEUE)
    private readonly queue: Queue<SizeGuideExtractionJobData>,
  ) {
    super();
  }

  async register(input: RegisterSizeGuideInput) {
    const existing = await this.prisma.productSizeGuide.findUnique({
      where: { externalProductId: input.externalProductId },
      select: { id: true, sourceUrl: true, status: true, failureReason: true },
    });
    const sourceChanged = existing?.sourceUrl !== input.sizeGuide.sourceUrl;
    const stoppedForBilling =
      existing?.failureReason === BILLING_SYNC_STOPPED_MESSAGE;
    const structuredData = input.sizeGuide.structuredData;

    const guide = await this.prisma.productSizeGuide.upsert({
      where: { externalProductId: input.externalProductId },
      create: {
        productId: input.productId,
        externalProductId: input.externalProductId,
        sourceUrl: input.sizeGuide.sourceUrl,
        rawText: input.sizeGuide.rawText,
        structuredData,
        normalizedText: structuredData
          ? formatNormalizedSizeGuide(structuredData)
          : null,
        confidence: structuredData?.confidence,
        status: structuredData
          ? SizeGuideStatus.READY
          : SizeGuideStatus.PENDING,
        analyzedAt: structuredData ? new Date() : null,
      },
      update:
        sourceChanged || structuredData
          ? {
              productId: input.productId,
              sourceUrl: input.sizeGuide.sourceUrl,
              rawText: input.sizeGuide.rawText,
              structuredData: structuredData ?? Prisma.DbNull,
              normalizedText: structuredData
                ? formatNormalizedSizeGuide(structuredData)
                : null,
              confidence: structuredData?.confidence ?? null,
              status: structuredData
                ? SizeGuideStatus.READY
                : SizeGuideStatus.PENDING,
              failureReason: null,
              analyzedAt: structuredData ? new Date() : null,
            }
          : {
              productId: input.productId,
              rawText: input.sizeGuide.rawText,
            },
      select: { id: true, status: true },
    });

    if (
      structuredData ||
      (!sourceChanged && guide.status === SizeGuideStatus.READY) ||
      guide.status === SizeGuideStatus.PROCESSING ||
      (!sourceChanged &&
        guide.status === SizeGuideStatus.FAILED &&
        !stoppedForBilling)
    ) {
      return;
    }

    const sourceHash = createHash('sha256')
      .update(input.sizeGuide.sourceUrl)
      .digest('hex')
      .slice(0, 12);
    const jobId = `size-guide-${guide.id}-${sourceHash}`;
    if (stoppedForBilling) {
      // Only a terminal billing-stopped job may be retried by the next full sync.
      const previousJob = await this.queue.getJob(jobId);
      if (previousJob && (await previousJob.getState()) === 'failed')
        await previousJob.remove();
    }
    await this.queue.add(
      EXTRACT_SIZE_GUIDE_JOB,
      { sizeGuideId: guide.id },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 250 },
        removeOnFail: failedJobRetention(500),
      },
    );
    this.logger.debug(`Beden tablosu analizi kuyruğa eklendi: ${guide.id}`);
  }
}

export function formatNormalizedSizeGuide(input: {
  title?: string;
  unit: string;
  headers: string[];
  rows: Array<{
    label: string;
    measurements: Array<{ name: string; value: string }>;
  }>;
  notes: string[];
}) {
  const lines = [
    input.title?.trim() || 'Beden tablosu',
    `Ölçü birimi: ${input.unit}`,
    ...input.rows.map((row) =>
      [
        `Beden ${row.label}`,
        ...row.measurements.map(
          (measurement) => `${measurement.name}: ${measurement.value}`,
        ),
      ].join(' · '),
    ),
    ...input.notes.map((note) => `Not: ${note}`),
  ];

  return lines.filter(Boolean).join('\n').slice(0, 12_000);
}
