import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncKind,
  CatalogSyncStatus,
  NotificationType,
  OperationalEmailIncidentKind,
  OperationalEmailIncidentStatus,
  OperationalEmailPhase,
  ProductStatus,
  StoreRole,
  StoreStatus,
  SyncEmailDeliveryStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { hasBillingAccess } from '../billing/billing-access.policy';
import { entitlementsFor } from '../billing/billing-plan.config';
import { resolveBillingUsageWindow } from '../billing/billing-usage-window';
import type { AiEmailEvent } from './email-templates/ai-email.template';
import type { ProductCapacityEmailEvent } from './email-templates/product-capacity-email.template';
import {
  NOTIFICATION_EMAIL_DIGEST_QUEUE,
  SEND_OPERATIONAL_INCIDENT_EMAIL_JOB,
} from './notification-email-digest.constants';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  operationalRecoveryDue,
  operationalSummaryDue,
} from './operational-email-incident.policy';

const CLAIM_DURATION_MS = 2 * 60_000;
const INCIDENT_RETENTION_MS = 90 * 24 * 60 * 60_000;

type IncidentInput = {
  storeId: string;
  kind: OperationalEmailIncidentKind;
  connectionId?: string;
};

@Injectable()
export class OperationalEmailIncidentService {
  private readonly logger = new Logger(OperationalEmailIncidentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
    @InjectQueue(NOTIFICATION_EMAIL_DIGEST_QUEUE)
    private readonly queue: Queue,
  ) {}

  async recordFailure(input: IncidentInput) {
    const scopeKey = isWarningKind(input.kind)
      ? await this.warningScopeKey(input)
      : (input.connectionId ?? 'store');
    const incident = await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "store" WHERE "id" = ${input.storeId} FOR UPDATE`,
      );
      if (locked.length === 0) return null;

      const now = new Date();
      if (isWarningKind(input.kind)) {
        await transaction.operationalEmailIncident.updateMany({
          where: {
            storeId: input.storeId,
            kind: input.kind,
            status: OperationalEmailIncidentStatus.OPEN,
            scopeKey: { not: scopeKey },
            ...(input.connectionId ? { connectionId: input.connectionId } : {}),
          },
          data: {
            status: OperationalEmailIncidentStatus.RESOLVED,
            resolvedAt: now,
            resolvedEmailAt: now,
          },
        });
      }
      const existing = await transaction.operationalEmailIncident.findFirst({
        where: {
          storeId: input.storeId,
          kind: input.kind,
          scopeKey,
          status: OperationalEmailIncidentStatus.OPEN,
        },
        select: {
          id: true,
          failureCount: true,
          lastEmailedFailureCount: true,
          lastEmailAt: true,
        },
      });
      if (existing) {
        const updated = await transaction.operationalEmailIncident.update({
          where: { id: existing.id },
          data: {
            failureCount: { increment: 1 },
            lastFailureAt: now,
            recoveryCandidateAt: null,
          },
          select: {
            id: true,
            failureCount: true,
            lastEmailedFailureCount: true,
            lastEmailAt: true,
          },
        });
        return { ...updated, isNew: false };
      }

      const created = await transaction.operationalEmailIncident.create({
        data: {
          storeId: input.storeId,
          connectionId: input.connectionId,
          scopeKey,
          kind: input.kind,
          openedAt: now,
          lastFailureAt: now,
        },
        select: {
          id: true,
          failureCount: true,
          lastEmailedFailureCount: true,
          lastEmailAt: true,
        },
      });
      return { ...created, isNew: true };
    });

    if (
      incident &&
      (incident.isNew ||
        (!isWarningKind(input.kind) &&
          operationalSummaryDue(
            incident.failureCount,
            incident.lastEmailedFailureCount,
            incident.lastEmailAt,
            new Date(),
          )))
    ) {
      await this.enqueue(incident.id);
    }
  }

  async recordSuccess(input: IncidentInput) {
    const incidentId = await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "store" WHERE "id" = ${input.storeId} FOR UPDATE`,
      );
      if (locked.length === 0) return null;

      const incident = await transaction.operationalEmailIncident.findFirst({
        where: {
          storeId: input.storeId,
          kind: input.kind,
          scopeKey: input.connectionId ?? 'store',
          status: OperationalEmailIncidentStatus.OPEN,
          recoveryCandidateAt: null,
        },
        select: { id: true },
      });
      if (!incident) return null;
      await transaction.operationalEmailIncident.update({
        where: { id: incident.id },
        data: { recoveryCandidateAt: new Date() },
      });
      return incident.id;
    });

    if (incidentId) await this.enqueue(incidentId, 5 * 60_000);
  }

  async resolveWarning(input: IncidentInput) {
    if (!isWarningKind(input.kind)) return;
    await this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "store" WHERE "id" = ${input.storeId} FOR UPDATE`,
      );
      if (locked.length === 0) return;
      const state =
        input.kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY
          ? null
          : await this.warningState(input, transaction);
      await transaction.operationalEmailIncident.updateMany({
        where: {
          storeId: input.storeId,
          kind: input.kind,
          status: OperationalEmailIncidentStatus.OPEN,
          ...(input.connectionId ? { connectionId: input.connectionId } : {}),
          ...(state && !state.resolved
            ? { scopeKey: { not: state.scopeKey } }
            : {}),
        },
        data: {
          status: OperationalEmailIncidentStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedEmailAt: new Date(),
        },
      });
    });
  }

  async processDue() {
    const now = new Date();
    let cursor: string | undefined;
    let failures = 0;

    while (true) {
      const incidents = await this.prisma.operationalEmailIncident.findMany({
        where: {
          ...(cursor ? { id: { gt: cursor } } : {}),
          OR: [
            { status: OperationalEmailIncidentStatus.OPEN },
            {
              status: OperationalEmailIncidentStatus.RESOLVED,
              resolvedEmailAt: null,
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
            `Operasyon e-postası işlenemedi (${incident.id}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          );
        }
      }
      cursor = incidents[incidents.length - 1].id;
    }

    await this.prisma.operationalEmailIncident.deleteMany({
      where: {
        status: OperationalEmailIncidentStatus.RESOLVED,
        resolvedEmailAt: {
          lte: new Date(now.getTime() - INCIDENT_RETENTION_MS),
        },
      },
    });
    if (failures > 0)
      throw new Error(`${failures} operasyon e-postası yeniden denenecek.`);
  }

  async processIncident(id: string) {
    if (!this.delivery.emailConfigured) return;
    const token = randomUUID();
    const now = new Date();
    const claim = await this.prisma.operationalEmailIncident.updateMany({
      where: {
        id,
        OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      },
      data: {
        claimToken: token,
        claimUntil: new Date(now.getTime() + CLAIM_DURATION_MS),
      },
    });
    if (claim.count === 0) return;

    try {
      await this.resolveIfDue(id);
      await this.reconcileWarning(id);
      const incident = await this.prisma.operationalEmailIncident.findUnique({
        where: { id },
        include: {
          store: {
            select: {
              name: true,
              workspaceId: true,
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
      });
      if (!incident) return;
      if (incident.store.status !== StoreStatus.ACTIVE) {
        await this.prisma.operationalEmailIncident.updateMany({
          where: { id },
          data: {
            status: OperationalEmailIncidentStatus.RESOLVED,
            resolvedAt: now,
            resolvedEmailAt: now,
          },
        });
        return;
      }
      if (incident.status === OperationalEmailIncidentStatus.RESOLVED) {
        const reopened = await this.prisma.operationalEmailIncident.findFirst({
          where: {
            storeId: incident.storeId,
            kind: incident.kind,
            scopeKey: incident.scopeKey,
            status: OperationalEmailIncidentStatus.OPEN,
          },
          select: { id: true },
        });
        if (reopened) {
          await this.prisma.operationalEmailIncident.updateMany({
            where: { id, claimToken: token },
            data: { resolvedEmailAt: new Date() },
          });
          return;
        }
      }

      const phase = this.phaseFor(incident, now);
      if (!phase) return;
      const productCapacityEmail =
        incident.kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY
          ? await this.productCapacityEmailEvent(
              incident.store.workspaceId,
              incident.connectionId,
              incident.lastFailureAt,
            )
          : undefined;
      const sequence =
        phase === OperationalEmailPhase.SUMMARY ? incident.failureCount : 0;
      const eligible = new Set([
        incident.store.workspace.ownerId,
        ...incident.store.workspace.members.map((member) => member.userId),
        ...incident.store.members
          .filter(
            (member) =>
              member.role === StoreRole.OWNER ||
              member.role === StoreRole.ADMIN ||
              member.role === StoreRole.AGENT,
          )
          .map((member) => member.userId),
      ]);
      const recipients =
        phase === OperationalEmailPhase.RESOLVED
          ? (
              await this.prisma.operationalEmailDelivery.findMany({
                where: {
                  incidentId: id,
                  phase: {
                    in: [
                      OperationalEmailPhase.OPEN,
                      OperationalEmailPhase.SUMMARY,
                    ],
                  },
                  status: SyncEmailDeliveryStatus.SENT,
                },
                select: { recipientUserId: true },
                distinct: ['recipientUserId'],
              })
            ).map((delivery) => delivery.recipientUserId)
          : [...eligible];
      const provider = incident.connectionId
        ? await this.prisma.channelConnection.findUnique({
            where: { id: incident.connectionId },
            select: { providerKey: true },
          })
        : null;

      let deferred = false;
      for (const userId of recipients) {
        const completed = await this.sendToRecipient({
          incidentId: id,
          storeId: incident.storeId,
          kind: incident.kind,
          storeName: incident.store.name,
          providerKey: provider?.providerKey ?? null,
          phase,
          sequence,
          userId,
          eligible: eligible.has(userId),
          newFailures: incident.failureCount - incident.lastEmailedFailureCount,
          productCapacityEmail,
        });
        if (!completed) deferred = true;
      }

      if (!deferred) {
        const completedAt = new Date();
        await this.prisma.operationalEmailIncident.updateMany({
          where: { id, status: incident.status, claimToken: token },
          data:
            phase === OperationalEmailPhase.RESOLVED
              ? { resolvedEmailAt: completedAt }
              : {
                  ...(phase === OperationalEmailPhase.OPEN
                    ? { openedEmailAt: completedAt }
                    : {}),
                  lastEmailAt: completedAt,
                  lastEmailedFailureCount: incident.failureCount,
                },
        });
      }
    } finally {
      await this.prisma.operationalEmailIncident.updateMany({
        where: { id, claimToken: token },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private phaseFor(
    incident: {
      kind: OperationalEmailIncidentKind;
      status: OperationalEmailIncidentStatus;
      failureCount: number;
      lastEmailedFailureCount: number;
      openedEmailAt: Date | null;
      lastEmailAt: Date | null;
      resolvedEmailAt: Date | null;
      recoveryCandidateAt: Date | null;
    },
    now: Date,
  ) {
    if (isWarningKind(incident.kind))
      return incident.status === OperationalEmailIncidentStatus.OPEN &&
        !incident.openedEmailAt
        ? OperationalEmailPhase.OPEN
        : null;
    if (incident.status === OperationalEmailIncidentStatus.RESOLVED)
      return incident.resolvedEmailAt ? null : OperationalEmailPhase.RESOLVED;
    if (!incident.openedEmailAt) return OperationalEmailPhase.OPEN;
    if (incident.recoveryCandidateAt) return null;
    return operationalSummaryDue(
      incident.failureCount,
      incident.lastEmailedFailureCount,
      incident.lastEmailAt,
      now,
    )
      ? OperationalEmailPhase.SUMMARY
      : null;
  }

  private async resolveIfDue(id: string) {
    await this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.operationalEmailIncident.findUnique({
        where: { id },
        select: { storeId: true },
      });
      if (!incident) return;
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "store" WHERE "id" = ${incident.storeId} FOR UPDATE`,
      );
      const current = await transaction.operationalEmailIncident.findUnique({
        where: { id },
        select: {
          status: true,
          kind: true,
          recoveryCandidateAt: true,
          lastFailureAt: true,
        },
      });
      const now = new Date();
      if (
        current?.status === OperationalEmailIncidentStatus.OPEN &&
        !isWarningKind(current.kind) &&
        operationalRecoveryDue(
          current.recoveryCandidateAt,
          current.lastFailureAt,
          now,
        )
      ) {
        await transaction.operationalEmailIncident.update({
          where: { id },
          data: {
            status: OperationalEmailIncidentStatus.RESOLVED,
            resolvedAt: now,
          },
        });
      }
    });
  }

  private async reconcileWarning(id: string) {
    const incident = await this.prisma.operationalEmailIncident.findUnique({
      where: { id },
      select: {
        storeId: true,
        connectionId: true,
        kind: true,
        scopeKey: true,
        status: true,
      },
    });
    if (
      !incident ||
      incident.status !== OperationalEmailIncidentStatus.OPEN ||
      !isWarningKind(incident.kind)
    )
      return;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "store" WHERE "id" = ${incident.storeId} FOR UPDATE`,
      );
      const current = await transaction.operationalEmailIncident.findUnique({
        where: { id },
        select: {
          storeId: true,
          connectionId: true,
          kind: true,
          scopeKey: true,
          status: true,
        },
      });
      if (
        !current ||
        current.status !== OperationalEmailIncidentStatus.OPEN ||
        !isWarningKind(current.kind)
      )
        return;
      const state = await this.warningState(
        {
          storeId: current.storeId,
          connectionId: current.connectionId ?? undefined,
          kind: current.kind,
        },
        transaction,
      );
      if (!state.resolved && state.scopeKey === current.scopeKey) return;
      await transaction.operationalEmailIncident.updateMany({
        where: { id, status: OperationalEmailIncidentStatus.OPEN },
        data: {
          status: OperationalEmailIncidentStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedEmailAt: new Date(),
        },
      });
    });
  }

  private async warningScopeKey(input: IncidentInput) {
    return (await this.warningState(input)).scopeKey;
  }

  private async warningState(
    input: IncidentInput,
    client: Pick<
      Prisma.TransactionClient,
      'store' | 'billingUsagePeriod'
    > = this.prisma,
  ) {
    const store = await client.store.findUnique({
      where: { id: input.storeId },
      select: {
        workspaceId: true,
        workspace: { select: { billingSubscription: true } },
      },
    });
    const subscription = store?.workspace.billingSubscription;
    const access = hasBillingAccess(subscription);

    if (input.kind === OperationalEmailIncidentKind.AI_BILLING_PAUSED) {
      return {
        scopeKey: 'billing',
        resolved: access,
      };
    }

    if (input.kind === OperationalEmailIncidentKind.AI_QUOTA_PAUSED) {
      if (!subscription || !store)
        return { scopeKey: 'quota:missing', resolved: true };
      const periodStart = resolveBillingUsageWindow(subscription).start;
      const period = await client.billingUsagePeriod.findUnique({
        where: {
          workspaceId_periodStart: {
            workspaceId: store.workspaceId,
            periodStart,
          },
        },
        select: { aiQuestionUnits: true },
      });
      const limit = entitlementsFor(
        subscription.plan,
        subscription.status,
      ).monthlyAiQuestions;
      return {
        scopeKey: `quota:${periodStart.toISOString()}`,
        resolved: !access || (period?.aiQuestionUnits ?? 0) < limit,
      };
    }

    if (input.kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY) {
      if (!subscription || !store)
        return { scopeKey: 'capacity:missing', resolved: true };
      return {
        scopeKey: `capacity:${input.connectionId ?? 'store'}`,
        resolved: !access,
      };
    }

    return {
      scopeKey: input.connectionId ?? 'store',
      resolved: false,
    };
  }

  private async productCapacityEmailEvent(
    workspaceId: string,
    connectionId: string | null,
    lastFailureAt: Date,
  ): Promise<ProductCapacityEmailEvent | undefined> {
    const [subscription, used, latestRun] = await Promise.all([
      this.prisma.billingSubscription.findUnique({
        where: { workspaceId },
        select: { plan: true, status: true },
      }),
      this.prisma.product.count({
        where: { store: { workspaceId }, status: ProductStatus.ACTIVE },
      }),
      connectionId
        ? this.prisma.catalogSyncRun.findFirst({
            where: {
              connectionId,
              kind: CatalogSyncKind.FULL,
              updatedAt: {
                gte: new Date(lastFailureAt.getTime() - 60_000),
                lte: lastFailureAt,
              },
            },
            orderBy: { startedAt: 'desc' },
            select: { status: true, productsSkipped: true },
          })
        : Promise.resolve(null),
    ]);
    if (!subscription) return undefined;

    const planName =
      subscription.plan === 'STARTER'
        ? 'Starter'
        : subscription.plan === 'GROWTH'
          ? 'Growth'
          : 'Business';
    return {
      planName,
      used,
      limit: entitlementsFor(subscription.plan, subscription.status)
        .activeProducts,
      skippedCount:
        latestRun?.status === CatalogSyncStatus.COMPLETED &&
        latestRun.productsSkipped > 0
          ? latestRun.productsSkipped
          : null,
    };
  }

  private async sendToRecipient(input: {
    incidentId: string;
    storeId: string;
    kind: OperationalEmailIncidentKind;
    storeName: string;
    providerKey: string | null;
    phase: OperationalEmailPhase;
    sequence: number;
    userId: string;
    eligible: boolean;
    newFailures: number;
    productCapacityEmail?: ProductCapacityEmailEvent;
  }) {
    const delivery = await this.prisma.operationalEmailDelivery.upsert({
      where: {
        incidentId_recipientUserId_phase_sequence: {
          incidentId: input.incidentId,
          recipientUserId: input.userId,
          phase: input.phase,
          sequence: input.sequence,
        },
      },
      create: {
        incidentId: input.incidentId,
        recipientUserId: input.userId,
        phase: input.phase,
        sequence: input.sequence,
      },
      update: {},
    });
    if (delivery.status !== SyncEmailDeliveryStatus.PENDING) return true;

    const token = randomUUID();
    const now = new Date();
    const claim = await this.prisma.operationalEmailDelivery.updateMany({
      where: {
        id: delivery.id,
        status: SyncEmailDeliveryStatus.PENDING,
        OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      },
      data: {
        claimToken: token,
        claimUntil: new Date(now.getTime() + CLAIM_DURATION_MS),
      },
    });
    if (claim.count === 0) return false;

    try {
      const current = await this.prisma.operationalEmailIncident.findUnique({
        where: { id: input.incidentId },
        select: { status: true, failureCount: true },
      });
      const expectedStatus =
        input.phase === OperationalEmailPhase.RESOLVED
          ? OperationalEmailIncidentStatus.RESOLVED
          : OperationalEmailIncidentStatus.OPEN;
      const outcome =
        !input.eligible ||
        !current ||
        current.status !== expectedStatus ||
        (input.phase === OperationalEmailPhase.SUMMARY &&
          current.failureCount < input.sequence)
          ? 'SKIPPED'
          : await this.delivery.sendSyncIncidentEmail(
              input.userId,
              input.storeId,
              notificationType(input.kind),
              emailTitle(
                input.storeName,
                input.providerKey,
                input.kind,
                input.phase,
              ),
              emailMessage(input.kind, input.phase, input.newFailures),
              isWarningKind(input.kind) ? '/billing' : '/dashboard/inbox',
              `operational:${input.incidentId}:${input.phase}:${input.sequence}:${input.userId}`,
              {
                ai: aiEmailEvent(input.kind, input.phase, input.newFailures),
                productCapacity: input.productCapacityEmail,
              },
            );
      if (outcome === 'DEFERRED') return false;
      await this.prisma.operationalEmailDelivery.updateMany({
        where: { id: delivery.id, claimToken: token },
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
      await this.prisma.operationalEmailDelivery.updateMany({
        where: { id: delivery.id, claimToken: token },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private async enqueue(incidentId: string, delay = 0) {
    await this.queue.add(
      SEND_OPERATIONAL_INCIDENT_EMAIL_JOB,
      { incidentId },
      {
        jobId: `operational-email-${incidentId}`,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}

function notificationType(kind: OperationalEmailIncidentKind) {
  if (kind === OperationalEmailIncidentKind.AI_DRAFT)
    return NotificationType.AI_DRAFT_FAILED;
  if (kind === OperationalEmailIncidentKind.ANSWER_DELIVERY)
    return NotificationType.ANSWER_DELIVERY_FAILED;
  if (kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY)
    return NotificationType.BILLING_PLAN_LIMIT;
  return NotificationType.AI_AUTOMATION_PAUSED;
}

function aiEmailEvent(
  kind: OperationalEmailIncidentKind,
  phase: OperationalEmailPhase,
  newFailures: number,
): AiEmailEvent | undefined {
  if (kind === OperationalEmailIncidentKind.AI_QUOTA_PAUSED)
    return { kind: 'AUTOMATION_PAUSED', reason: 'quota' };
  if (kind === OperationalEmailIncidentKind.AI_BILLING_PAUSED)
    return { kind: 'AUTOMATION_PAUSED', reason: 'subscription' };
  if (
    kind !== OperationalEmailIncidentKind.AI_DRAFT &&
    kind !== OperationalEmailIncidentKind.ANSWER_DELIVERY
  )
    return undefined;
  const process =
    kind === OperationalEmailIncidentKind.AI_DRAFT ? 'draft' : 'answer';
  if (phase === OperationalEmailPhase.RESOLVED)
    return { kind: 'OPERATION_RECOVERED', process };
  return {
    kind: 'OPERATION_FAILURE',
    process,
    phase: phase === OperationalEmailPhase.SUMMARY ? 'summary' : 'initial',
    affectedCount: Math.max(1, newFailures),
  };
}

function isWarningKind(kind: OperationalEmailIncidentKind) {
  return (
    kind === OperationalEmailIncidentKind.AI_QUOTA_PAUSED ||
    kind === OperationalEmailIncidentKind.AI_BILLING_PAUSED ||
    kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY
  );
}

function emailTitle(
  storeName: string,
  providerKey: string | null,
  kind: OperationalEmailIncidentKind,
  phase: OperationalEmailPhase,
) {
  const provider =
    providerKey === 'trendyol'
      ? 'Trendyol'
      : providerKey === 'hepsiburada'
        ? 'Hepsiburada'
        : providerKey;
  if (isWarningKind(kind)) {
    const warning =
      kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY
        ? 'Ürün kapasitesi sınırına ulaşıldı'
        : 'AI otomasyonu durduruldu';
    return `${storeName.slice(0, 60)}${provider ? ` · ${provider}` : ''}: ${warning}`;
  }
  const subject =
    kind === OperationalEmailIncidentKind.AI_DRAFT
      ? 'AI taslakları'
      : 'Cevap gönderimi';
  const prefix = `${storeName.slice(0, 60)}${provider ? ` · ${provider}` : ''}: ${subject}`;
  return phase === OperationalEmailPhase.RESOLVED
    ? `${prefix} yeniden çalışıyor`
    : phase === OperationalEmailPhase.SUMMARY
      ? `${prefix} hata özeti`
      : `${prefix} hatası`;
}

function emailMessage(
  kind: OperationalEmailIncidentKind,
  phase: OperationalEmailPhase,
  newFailures: number,
) {
  if (kind === OperationalEmailIncidentKind.AI_QUOTA_PAUSED)
    return 'AI soru hakkınız dolduğu için yeni otomatik taslaklar hazırlanmıyor. Yeni dönem başladığında veya planınız yükseldiğinde üretim yeniden kullanılabilir.';
  if (kind === OperationalEmailIncidentKind.AI_BILLING_PAUSED)
    return 'Abonelik erişiminiz aktif olmadığı için AI otomasyonu durduruldu. Plan ve ödeme durumunuzu kontrol edin.';
  if (kind === OperationalEmailIncidentKind.PRODUCT_CAPACITY)
    return 'Ürün kapasitesi sınırına ulaşıldı. Yeni ürünler içe aktarılamayabilir; planınızı ve katalog kullanımınızı kontrol edin.';
  const label =
    kind === OperationalEmailIncidentKind.AI_DRAFT
      ? 'AI taslağı hazırlanamadı'
      : 'cevap pazaryerine gönderilemedi';
  if (phase === OperationalEmailPhase.RESOLVED)
    return 'İşlem yeniden başarıyla tamamlandı. Önceden başarısız olan soruları gelen kutusunda ayrıca kontrol edin.';
  if (phase === OperationalEmailPhase.SUMMARY)
    return `Son bildirimin ardından ${newFailures} soruda daha ${label}. Soruları gelen kutusunda kontrol edin.`;
  return `${newFailures > 1 ? `${newFailures} soruda` : 'Bir soruda'} ${label}. Benzer hatalar tekrar ederse ayrı e-postalar yerine toplu bir özet gönderilecek. Soruları gelen kutusunda kontrol edin.`;
}
