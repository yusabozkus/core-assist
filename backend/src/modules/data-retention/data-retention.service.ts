import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncStatus,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import {
  dataRetentionCutoff,
  resolveDataRetentionPolicy,
} from './data-retention.policy';

const BATCH_SIZE = 500;
const MAX_BATCHES_PER_COLLECTION = 20;

type BatchResult = { matched: number; deleted: number };

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanup(now = new Date()) {
    const policy = resolveDataRetentionPolicy();
    const auditLogs = await this.prune(() =>
      this.deleteAuditLogBatch(dataRetentionCutoff(now, policy.auditLogDays)),
    );
    const completedSyncRuns = await this.prune(() =>
      this.deleteSyncRunBatch(
        CatalogSyncStatus.COMPLETED,
        dataRetentionCutoff(now, policy.completedSyncRunDays),
      ),
    );
    const failedSyncRuns = await this.prune(() =>
      this.deleteSyncRunBatch(
        CatalogSyncStatus.FAILED,
        dataRetentionCutoff(now, policy.failedSyncRunDays),
      ),
    );
    const resolvedSupportTickets = await this.prune(() =>
      this.deleteSupportTicketBatch(
        SupportTicketStatus.RESOLVED,
        'resolvedAt',
        dataRetentionCutoff(now, policy.resolvedSupportTicketDays),
      ),
    );
    const closedSupportTickets = await this.prune(() =>
      this.deleteSupportTicketBatch(
        SupportTicketStatus.CLOSED,
        'closedAt',
        dataRetentionCutoff(now, policy.closedSupportTicketDays),
      ),
    );
    const archivedContactMessages = await this.prune(() =>
      this.deleteArchivedContactMessageBatch(
        dataRetentionCutoff(now, policy.archivedContactMessageDays),
      ),
    );

    const result = {
      auditLogs,
      completedSyncRuns,
      failedSyncRuns,
      resolvedSupportTickets,
      closedSupportTickets,
      archivedContactMessages,
    };
    const total = Object.values(result).reduce((sum, count) => sum + count, 0);

    if (total > 0) {
      this.logger.log({
        message: 'Expired operational records were removed.',
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

  private async deleteAuditLogBatch(cutoff: Date): Promise<BatchResult> {
    const records = await this.prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };

    const deleted = await this.prisma.auditLog.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        createdAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteSyncRunBatch(
    status:
      typeof CatalogSyncStatus.COMPLETED | typeof CatalogSyncStatus.FAILED,
    cutoff: Date,
  ): Promise<BatchResult> {
    const where = {
      status,
      updatedAt: { lt: cutoff },
    } satisfies Prisma.CatalogSyncRunWhereInput;
    const records = await this.prisma.catalogSyncRun.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };

    const deleted = await this.prisma.catalogSyncRun.deleteMany({
      where: { ...where, id: { in: records.map((record) => record.id) } },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteSupportTicketBatch(
    status:
      typeof SupportTicketStatus.RESOLVED | typeof SupportTicketStatus.CLOSED,
    dateField: 'resolvedAt' | 'closedAt',
    cutoff: Date,
  ): Promise<BatchResult> {
    const where = {
      status,
      [dateField]: { lt: cutoff },
    } satisfies Prisma.SupportTicketWhereInput;
    const records = await this.prisma.supportTicket.findMany({
      where,
      orderBy: [{ [dateField]: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };

    const deleted = await this.prisma.supportTicket.deleteMany({
      where: { ...where, id: { in: records.map((record) => record.id) } },
    });
    return { matched: records.length, deleted: deleted.count };
  }

  private async deleteArchivedContactMessageBatch(
    cutoff: Date,
  ): Promise<BatchResult> {
    const records = await this.prisma.contactMessage.findMany({
      where: { status: 'ARCHIVED', archivedAt: { lt: cutoff } },
      orderBy: [{ archivedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    if (records.length === 0) return { matched: 0, deleted: 0 };

    const deleted = await this.prisma.contactMessage.deleteMany({
      where: {
        id: { in: records.map((record) => record.id) },
        status: 'ARCHIVED',
        archivedAt: { lt: cutoff },
      },
    });
    return { matched: records.length, deleted: deleted.count };
  }
}
