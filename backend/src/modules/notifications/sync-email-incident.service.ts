import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '../../generated/prisma/client';
import {
  ChannelConnectionStatus,
  NotificationType,
  StoreRole,
  StoreStatus,
  SyncEmailDeliveryPhase,
  SyncEmailDeliveryStatus,
  SyncEmailIncidentKind,
  SyncEmailIncidentStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  NOTIFICATION_EMAIL_DIGEST_QUEUE,
  SEND_SYNC_INCIDENT_EMAIL_JOB,
} from './notification-email-digest.constants';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  SYNC_FAILURE_EMAIL_THRESHOLD,
  syncIncidentEmailDue,
} from './sync-email-incident.policy';

const CLAIM_DURATION_MS = 2 * 60_000;
const INCIDENT_RETENTION_MS = 90 * 24 * 60 * 60_000;

type FailureInput = {
  storeId: string;
  connectionId: string;
  kind: SyncEmailIncidentKind;
  runId?: string;
};

@Injectable()
export class SyncEmailIncidentService {
  private readonly logger = new Logger(SyncEmailIncidentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
    @InjectQueue(NOTIFICATION_EMAIL_DIGEST_QUEUE)
    private readonly queue: Queue,
  ) {}

  async recordFailure(input: FailureInput) {
    const incident = await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "channel_connection" WHERE "id" = ${input.connectionId} AND "storeId" = ${input.storeId} FOR UPDATE`,
      );
      if (locked.length === 0) return null;

      const now = new Date();
      if (input.kind !== SyncEmailIncidentKind.AUTH) {
        const activeAuth = await transaction.syncEmailIncident.findFirst({
          where: {
            connectionId: input.connectionId,
            kind: SyncEmailIncidentKind.AUTH,
            status: SyncEmailIncidentStatus.OPEN,
          },
          select: { id: true },
        });
        if (activeAuth) return null;
      }

      const open = await transaction.syncEmailIncident.findFirst({
        where: {
          connectionId: input.connectionId,
          kind: input.kind,
          status: SyncEmailIncidentStatus.OPEN,
        },
        select: {
          id: true,
          failureCount: true,
          lastRunId: true,
          openEmailCompletedAt: true,
        },
      });
      if (!open) {
        return transaction.syncEmailIncident.create({
          data: {
            connectionId: input.connectionId,
            kind: input.kind,
            lastRunId: input.runId,
            openedAt: now,
            lastFailureAt: now,
          },
          select: { id: true, failureCount: true, openEmailCompletedAt: true },
        });
      }
      if (input.runId && open.lastRunId === input.runId) return null;
      return transaction.syncEmailIncident.update({
        where: { id: open.id },
        data: {
          failureCount: { increment: 1 },
          lastRunId: input.runId,
          lastFailureAt: now,
        },
        select: { id: true, failureCount: true, openEmailCompletedAt: true },
      });
    });

    if (
      incident &&
      !incident.openEmailCompletedAt &&
      (input.kind === SyncEmailIncidentKind.AUTH ||
        incident.failureCount >= SYNC_FAILURE_EMAIL_THRESHOLD)
    ) {
      await this.enqueue(incident.id);
    }
  }

  async resolve(connectionId: string, kinds: SyncEmailIncidentKind[]) {
    const incidentIds = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "channel_connection" WHERE "id" = ${connectionId} FOR UPDATE`,
      );
      const open = await transaction.syncEmailIncident.findMany({
        where: {
          connectionId,
          kind: { in: kinds },
          status: SyncEmailIncidentStatus.OPEN,
        },
        select: { id: true },
      });
      if (open.length === 0) return [];
      await transaction.syncEmailIncident.updateMany({
        where: { id: { in: open.map((incident) => incident.id) } },
        data: {
          status: SyncEmailIncidentStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
      return open.map((incident) => incident.id);
    });
    await Promise.all(incidentIds.map((id) => this.enqueue(id)));
  }

  async discard(connectionId: string) {
    await this.prisma.syncEmailIncident.updateMany({
      where: { connectionId, status: SyncEmailIncidentStatus.OPEN },
      data: {
        status: SyncEmailIncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedEmailCompletedAt: new Date(),
      },
    });
  }

  async processDue() {
    const now = new Date();
    let cursor: string | undefined;
    let failures = 0;

    while (true) {
      const incidents = await this.prisma.syncEmailIncident.findMany({
        where: {
          ...(cursor ? { id: { gt: cursor } } : {}),
          OR: [
            {
              status: SyncEmailIncidentStatus.OPEN,
            },
            {
              status: SyncEmailIncidentStatus.RESOLVED,
              resolvedEmailCompletedAt: null,
            },
          ],
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: { id: true },
      });
      if (incidents.length === 0) break;
      for (const incident of incidents) {
        try {
          await this.processIncident(incident.id);
        } catch (error) {
          failures += 1;
          this.logger.warn(
            `Senkronizasyon e-postası işlenemedi (${incident.id}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          );
        }
      }
      cursor = incidents[incidents.length - 1].id;
    }

    await this.prisma.syncEmailIncident.deleteMany({
      where: {
        status: SyncEmailIncidentStatus.RESOLVED,
        resolvedEmailCompletedAt: {
          lte: new Date(now.getTime() - INCIDENT_RETENTION_MS),
        },
      },
    });
    if (failures > 0)
      throw new Error(
        `${failures} senkronizasyon e-postası yeniden denenecek.`,
      );
  }

  async processIncident(id: string) {
    if (!this.delivery.emailConfigured) return;
    const incident = await this.prisma.syncEmailIncident.findUnique({
      where: { id },
      include: {
        connection: {
          select: {
            storeId: true,
            providerKey: true,
            status: true,
            removedAt: true,
            connectedAt: true,
            lastSyncAt: true,
            lastInventorySyncAt: true,
            lastQuestionSyncAt: true,
            store: {
              select: {
                name: true,
                status: true,
                members: { select: { userId: true, role: true } },
                workspace: {
                  select: {
                    ownerId: true,
                    members: {
                      where: { role: WorkspaceRole.ADMIN },
                      select: { userId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!incident) return;

    const { connection } = incident;
    if (incident.status === SyncEmailIncidentStatus.OPEN) {
      if (
        connection.removedAt ||
        connection.status === ChannelConnectionStatus.DISCONNECTED ||
        connection.store.status !== StoreStatus.ACTIVE
      ) {
        await this.discard(incident.connectionId);
        return;
      }
      if (connectionRecovered(incident, connection)) {
        await this.resolve(incident.connectionId, [incident.kind]);
        return;
      }
      if (incident.openEmailCompletedAt) return;
      if (incident.kind !== SyncEmailIncidentKind.AUTH) {
        const activeAuth = await this.prisma.syncEmailIncident.findFirst({
          where: {
            connectionId: incident.connectionId,
            kind: SyncEmailIncidentKind.AUTH,
            status: SyncEmailIncidentStatus.OPEN,
          },
          select: { id: true },
        });
        if (activeAuth) return;
      }
      if (
        !syncIncidentEmailDue(
          incident.kind,
          incident.failureCount,
          incident.openedAt,
          new Date(),
        )
      )
        return;
    } else if (incident.resolvedEmailCompletedAt) {
      return;
    }

    const eligibleRecipients = new Set([
      connection.store.workspace.ownerId,
      ...connection.store.workspace.members.map((member) => member.userId),
      ...connection.store.members
        .filter(
          (member) =>
            member.role === StoreRole.OWNER || member.role === StoreRole.ADMIN,
        )
        .map((member) => member.userId),
    ]);
    const phase =
      incident.status === SyncEmailIncidentStatus.OPEN
        ? SyncEmailDeliveryPhase.OPEN
        : SyncEmailDeliveryPhase.RESOLVED;
    const recipients =
      phase === SyncEmailDeliveryPhase.OPEN
        ? [...eligibleRecipients]
        : (
            await this.prisma.syncEmailIncidentDelivery.findMany({
              where: {
                incidentId: id,
                phase: SyncEmailDeliveryPhase.OPEN,
                status: SyncEmailDeliveryStatus.SENT,
              },
              select: { recipientUserId: true },
            })
          ).map((delivery) => delivery.recipientUserId);

    let deferred = false;
    for (const userId of recipients) {
      if (!eligibleRecipients.has(userId)) {
        await this.markSkipped(id, userId, phase);
        continue;
      }
      const completed = await this.sendToRecipient(
        incident,
        userId,
        phase,
        connection.storeId,
        connection.store.name,
        connection.providerKey,
      );
      if (!completed) deferred = true;
    }

    if (!deferred) {
      await this.prisma.syncEmailIncident.updateMany({
        where: { id, status: incident.status },
        data:
          phase === SyncEmailDeliveryPhase.OPEN
            ? { openEmailCompletedAt: new Date() }
            : { resolvedEmailCompletedAt: new Date() },
      });
    }
  }

  private async sendToRecipient(
    incident: {
      id: string;
      kind: SyncEmailIncidentKind;
      status: SyncEmailIncidentStatus;
    },
    userId: string,
    phase: SyncEmailDeliveryPhase,
    storeId: string,
    storeName: string,
    providerKey: string,
  ) {
    const delivery = await this.prisma.syncEmailIncidentDelivery.upsert({
      where: {
        incidentId_recipientUserId_phase: {
          incidentId: incident.id,
          recipientUserId: userId,
          phase,
        },
      },
      create: { incidentId: incident.id, recipientUserId: userId, phase },
      update: {},
    });
    if (delivery.status !== SyncEmailDeliveryStatus.PENDING) return true;

    const claimToken = randomUUID();
    const now = new Date();
    const claim = await this.prisma.syncEmailIncidentDelivery.updateMany({
      where: {
        id: delivery.id,
        status: SyncEmailDeliveryStatus.PENDING,
        OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      },
      data: {
        claimToken,
        claimUntil: new Date(now.getTime() + CLAIM_DURATION_MS),
      },
    });
    if (claim.count === 0) return false;

    try {
      const current = await this.prisma.syncEmailIncident.findUnique({
        where: { id: incident.id },
        select: { status: true },
      });
      const outcome =
        !current || current.status !== incident.status
          ? 'SKIPPED'
          : await this.delivery.sendSyncIncidentEmail(
              userId,
              storeId,
              notificationType(incident.kind),
              emailTitle(storeName, providerKey, incident.kind, phase),
              emailMessage(incident.kind, phase),
              incident.kind === SyncEmailIncidentKind.AUTH
                ? '/dashboard/channels'
                : '/dashboard/channels/sync',
              `sync-incident:${incident.id}:${phase}:${userId}`,
            );
      if (outcome === 'DEFERRED') return false;
      await this.prisma.syncEmailIncidentDelivery.updateMany({
        where: { id: delivery.id, claimToken },
        data: {
          status:
            outcome === 'SENT'
              ? SyncEmailDeliveryStatus.SENT
              : SyncEmailDeliveryStatus.SKIPPED,
          sentAt: outcome === 'SENT' ? new Date() : null,
        },
      });
      return true;
    } finally {
      await this.prisma.syncEmailIncidentDelivery.updateMany({
        where: { id: delivery.id, claimToken },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private async markSkipped(
    incidentId: string,
    recipientUserId: string,
    phase: SyncEmailDeliveryPhase,
  ) {
    await this.prisma.syncEmailIncidentDelivery.upsert({
      where: {
        incidentId_recipientUserId_phase: {
          incidentId,
          recipientUserId,
          phase,
        },
      },
      create: {
        incidentId,
        recipientUserId,
        phase,
        status: SyncEmailDeliveryStatus.SKIPPED,
      },
      update: { status: SyncEmailDeliveryStatus.SKIPPED },
    });
  }

  private async enqueue(incidentId: string) {
    await this.queue.add(
      SEND_SYNC_INCIDENT_EMAIL_JOB,
      { incidentId },
      {
        jobId: `sync-email-incident-${incidentId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}

function notificationType(kind: SyncEmailIncidentKind) {
  if (kind === SyncEmailIncidentKind.AUTH)
    return NotificationType.CHANNEL_CONNECTION_ERROR;
  if (kind === SyncEmailIncidentKind.QUESTION)
    return NotificationType.QUESTION_SYNC_FAILED;
  return NotificationType.PRODUCT_SYNC_FAILED;
}

function connectionRecovered(
  incident: { kind: SyncEmailIncidentKind; openedAt: Date },
  connection: {
    status: ChannelConnectionStatus;
    connectedAt: Date | null;
    lastSyncAt: Date | null;
    lastInventorySyncAt: Date | null;
    lastQuestionSyncAt: Date | null;
  },
) {
  if (connection.status !== ChannelConnectionStatus.CONNECTED) return false;
  const recoveredAt =
    incident.kind === SyncEmailIncidentKind.FULL
      ? connection.lastSyncAt
      : incident.kind === SyncEmailIncidentKind.INVENTORY
        ? connection.lastInventorySyncAt
        : incident.kind === SyncEmailIncidentKind.QUESTION
          ? connection.lastQuestionSyncAt
          : [
              connection.connectedAt,
              connection.lastSyncAt,
              connection.lastInventorySyncAt,
              connection.lastQuestionSyncAt,
            ].reduce<Date | null>(
              (latest, date) =>
                date && (!latest || date > latest) ? date : latest,
              null,
            );
  return Boolean(recoveredAt && recoveredAt > incident.openedAt);
}

function emailTitle(
  storeName: string,
  providerKey: string,
  kind: SyncEmailIncidentKind,
  phase: SyncEmailDeliveryPhase,
) {
  const provider =
    providerKey === 'trendyol'
      ? 'Trendyol'
      : providerKey === 'hepsiburada'
        ? 'Hepsiburada'
        : providerKey;
  const prefix = `${storeName.slice(0, 60)} · ${provider}`;
  if (phase === SyncEmailDeliveryPhase.RESOLVED)
    return kind === SyncEmailIncidentKind.AUTH
      ? `${prefix}: Kanal bağlantısı yeniden sağlandı`
      : `${prefix}: Senkronizasyon sorunu düzeldi`;
  if (kind === SyncEmailIncidentKind.AUTH)
    return `${prefix}: Kanal bağlantısı kesildi`;
  const label =
    kind === SyncEmailIncidentKind.QUESTION
      ? 'Soru'
      : kind === SyncEmailIncidentKind.INVENTORY
        ? 'Stok'
        : 'Ürün';
  return `${prefix}: ${label} senkronizasyonu sorunlu`;
}

function emailMessage(
  kind: SyncEmailIncidentKind,
  phase: SyncEmailDeliveryPhase,
) {
  if (phase === SyncEmailDeliveryPhase.RESOLVED)
    return kind === SyncEmailIncidentKind.AUTH
      ? 'Kanal bağlantısı yeniden doğrulandı. Güncel verileri kontrol etmek için senkronizasyon sonucunu inceleyin.'
      : 'Senkronizasyon yeniden başarıyla tamamlandı. Ayrıntıları senkronizasyon geçmişinden inceleyebilirsiniz.';
  if (kind === SyncEmailIncidentKind.AUTH)
    return 'Pazaryeri bağlantısının kimlik bilgileri doğrulanamadı. Soru ve ürün senkronizasyonu ile cevap gönderimi etkilenebilir; kanal bağlantısını kontrol edin.';
  return 'Senkronizasyon sorunu devam ediyor. Güncel veriler gecikebilir; senkronizasyon geçmişini ve kanal bağlantısını kontrol edin.';
}
