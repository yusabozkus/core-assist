import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { BillingCheckoutStatus } from '../../generated/prisma/enums';
import {
  BILLING_RETENTION_POLICY,
  billingRetentionCutoff,
} from './billing-retention.policy';

const BATCH_SIZE = 500;
const MAX_BATCHES_PER_COLLECTION = 20;

type BatchResult = { matched: number; deleted: number };

@Injectable()
export class BillingRetentionService {
  private readonly logger = new Logger(BillingRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanup(now = new Date()) {
    const webhookEvents = await this.prune(() =>
      this.deleteWebhookEventBatch(
        billingRetentionCutoff(now, BILLING_RETENTION_POLICY.webhookEventDays),
      ),
    );
    const abandonedCheckouts = await this.prune(() =>
      this.deleteAbandonedCheckoutBatch(
        billingRetentionCutoff(
          now,
          BILLING_RETENTION_POLICY.abandonedCheckoutDays,
        ),
      ),
    );
    const expiredPreviews = await this.prune(() =>
      this.deleteExpiredPreviewBatch(
        billingRetentionCutoff(
          now,
          BILLING_RETENTION_POLICY.expiredPreviewGraceDays,
        ),
      ),
    );
    const failedPlanChanges = await this.prune(() =>
      this.deleteFailedPlanChangeBatch(
        billingRetentionCutoff(
          now,
          BILLING_RETENTION_POLICY.failedPlanChangeDays,
        ),
      ),
    );
    const completedPlanChanges = await this.prune(() =>
      this.deleteCompletedPlanChangeBatch(
        billingRetentionCutoff(
          now,
          BILLING_RETENTION_POLICY.completedPlanChangeDays,
        ),
      ),
    );
    const transactionReferences = await this.prune(() =>
      this.deleteTransactionReferenceBatch(
        billingRetentionCutoff(
          now,
          BILLING_RETENTION_POLICY.transactionReferenceDays,
        ),
      ),
    );

    const result = {
      webhookEvents,
      abandonedCheckouts,
      expiredPreviews,
      failedPlanChanges,
      completedPlanChanges,
      transactionReferences,
    };
    const total = Object.values(result).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      this.logger.log({
        message: 'Expired billing operational records were removed.',
        ...result,
      });
    }
    return result;
  }

  private async prune(deleteBatch: () => Promise<BatchResult>) {
    let total = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_COLLECTION; batch += 1) {
      const result = await deleteBatch();
      total += result.deleted;
      if (result.matched < BATCH_SIZE) break;
    }
    return total;
  }

  private async deleteWebhookEventBatch(cutoff: Date): Promise<BatchResult> {
    const records = await this.prisma.billingWebhookEvent.findMany({
      where: { processedAt: { lt: cutoff } },
      orderBy: [{ processedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };
    const deleted = await this.prisma.billingWebhookEvent.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        processedAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteAbandonedCheckoutBatch(
    cutoff: Date,
  ): Promise<BatchResult> {
    const where: Prisma.BillingCheckoutWhereInput = {
      status: {
        in: [BillingCheckoutStatus.CANCELED, BillingCheckoutStatus.FAILED],
      },
      updatedAt: { lt: cutoff },
      boundAt: null,
      paddleSubscriptionId: null,
    };
    const records = await this.prisma.billingCheckout.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };
    const deleted = await this.prisma.billingCheckout.deleteMany({
      where: { ...where, id: { in: records.map((record) => record.id) } },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteExpiredPreviewBatch(cutoff: Date): Promise<BatchResult> {
    const records = await this.prisma.billingPlanChange.findMany({
      where: { status: 'PREVIEWED', expiresAt: { lt: cutoff } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };
    const deleted = await this.prisma.billingPlanChange.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        status: 'PREVIEWED',
        expiresAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteFailedPlanChangeBatch(
    cutoff: Date,
  ): Promise<BatchResult> {
    return this.deleteTerminalPlanChangeBatch('FAILED', cutoff);
  }

  private async deleteCompletedPlanChangeBatch(
    cutoff: Date,
  ): Promise<BatchResult> {
    return this.deleteTerminalPlanChangeBatch('COMPLETED', cutoff);
  }

  private async deleteTerminalPlanChangeBatch(
    status: 'FAILED' | 'COMPLETED',
    cutoff: Date,
  ): Promise<BatchResult> {
    const records = await this.prisma.billingPlanChange.findMany({
      where: { status, updatedAt: { lt: cutoff } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };
    const deleted = await this.prisma.billingPlanChange.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        status,
        updatedAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteTransactionReferenceBatch(
    cutoff: Date,
  ): Promise<BatchResult> {
    const records = await this.prisma.billingTransactionReference.findMany({
      where: { updatedAt: { lt: cutoff } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };
    const deleted = await this.prisma.billingTransactionReference.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        updatedAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }
}
