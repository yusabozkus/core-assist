import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Paddle,
  type Subscription,
  type Transaction,
} from '@paddle/paddle-node-sdk';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { PENDING_PLAN_CHANGE_STATUSES } from '../billing/billing-plan-change.policy';
import {
  paddleCheckoutEnvironment,
  paddleEnvironment,
  requirePaddleApiKey,
} from '../billing/paddle-billing.config';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
  auditErrorCode,
} from '../audit/audit-log.service';

const workspaceInclude = {
  billingSubscription: true,
  billingCheckouts: { orderBy: { id: 'asc' as const } },
  billingPlanChanges: { orderBy: { id: 'asc' as const } },
  stores: { select: { id: true }, orderBy: { id: 'asc' as const } },
} satisfies Prisma.WorkspaceInclude;
type Workspace = Prisma.WorkspaceGetPayload<{
  include: typeof workspaceInclude;
}>;
type WorkspaceInspection = {
  workspace: Workspace;
  issues: string[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  customerIds: string[];
  cancelableTransactions: string[];
};
type Inspection = {
  workspaces: Workspace[];
  entries: WorkspaceInspection[];
  checkedAt: string;
};

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);
  private client: Paddle | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async getStatus(userId: string) {
    return this.summary(await this.inspect(userId));
  }

  async closeBilling(userId: string, sessionId: string) {
    await this.assertFreshSession(userId, sessionId);
    const auditBase = {
      actorType: AuditActorType.USER,
      actorUserId: userId,
      origin: AuditOrigin.API,
      action: AuditAction.ACCOUNT_BILLING_CLOSED,
      targetType: 'USER_ACCOUNT',
      targetId: userId,
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });
    try {
      const result = await this.closeBillingAfterFreshSession(userId);
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.SUCCESS,
        after: {
          canDelete: result.canDelete,
          canResolveBilling: result.canResolveBilling,
          workspaceCount: result.workspaces.length,
        },
      });
      return result;
    } catch (error) {
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
      });
      throw error;
    }
  }

  private async closeBillingAfterFreshSession(userId: string) {
    const inspection = await this.inspect(userId);
    if (
      inspection.workspaces.some((workspace) =>
        workspace.billingPlanChanges.some((change) =>
          PENDING_PLAN_CHANGE_STATUSES.includes(change.status),
        ),
      )
    ) {
      throw new ConflictException(
        'Plan değişikliği sonuçlanmadan hesap kapatma başlatılamaz. Önce bekleyen işlemi kontrol edin.',
      );
    }
    try {
      for (const entry of inspection.entries) {
        // IDs come exclusively from persisted, verified billing references.
        // Never use client-provided IDs or Paddle customData for cancellation.
        for (const id of entry.cancelableTransactions) {
          const canceled = await this.getClient().transactions.update(id, {
            status: 'canceled',
          });
          if (
            canceled.id !== id ||
            canceled.status !== 'canceled' ||
            canceled.subscriptionId
          ) {
            throw new Error('Transaction cancellation not confirmed');
          }
        }
        for (const subscription of entry.subscriptions) {
          if (subscription.status === 'canceled') continue;
          const canceled = await this.getClient().subscriptions.cancel(
            subscription.id,
            {
              effectiveFrom: 'immediately',
            },
          );
          if (
            canceled.id !== subscription.id ||
            canceled.status !== 'canceled'
          ) {
            throw new Error('Subscription cancellation not confirmed');
          }
        }
      }
    } catch {
      this.logger.error({
        message: 'Account billing closure failed; account retained.',
        userId,
      });
      throw new ServiceUnavailableException(
        'İptal işlemlerinin tamamı doğrulanamadı; hesabınız silinmedi. Bazı iptaller tamamlanmış olabilir. Durumu yenileyip tekrar deneyin.',
      );
    }
    // Re-fetch; an API request being accepted alone is not proof of settlement.
    return this.summary(await this.inspect(userId));
  }

  async deleteAccount(userId: string, sessionId: string) {
    await this.assertFreshSession(userId, sessionId);
    const auditBase = {
      actorType: AuditActorType.USER,
      actorUserId: userId,
      origin: AuditOrigin.API,
      action: AuditAction.ACCOUNT_DELETED,
      targetType: 'USER_ACCOUNT',
      targetId: userId,
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });
    try {
      return await this.deleteAccountAfterFreshSession(userId, sessionId);
    } catch (error) {
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
      });
      throw error;
    }
  }

  private async deleteAccountAfterFreshSession(
    userId: string,
    sessionId: string,
  ) {
    const inspection = await this.inspect(userId);
    if (!this.summary(inspection).canDelete) {
      throw new ConflictException(
        'Abonelikler ve bekleyen ödemeler kapanmadan hesap silinemez. Önce ödeme durumunu kontrol edin.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        // The user lock prevents a concurrent owned-workspace insertion (FK).
        // Checkout creation and webhook binding already use workspace row locks.
        await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${userId} FOR UPDATE`;
        await tx.$queryRaw`
        SELECT "id" FROM "workspace" WHERE "ownerId" = ${userId} ORDER BY "id" FOR UPDATE
      `;
        const current = await this.loadWorkspaces(userId, tx);
        for (const workspace of current) {
          await tx.$queryRaw`SELECT "id" FROM "billing_subscription" WHERE "workspaceId" = ${workspace.id} FOR UPDATE`;
        }
        const locked = await this.loadWorkspaces(userId, tx);
        if (JSON.stringify(locked) !== JSON.stringify(inspection.workspaces)) {
          throw new ConflictException(
            'Hesap veya ödeme bilgileri kontrol sırasında değişti. Durumu yenileyip tekrar deneyin.',
          );
        }
        await this.assertFreshSession(userId, sessionId, tx);
        // Queue/sync claims serialize through store rows, as in store deletion.
        for (const workspace of locked) {
          await tx.$queryRaw`SELECT "id" FROM "store" WHERE "workspaceId" = ${workspace.id} ORDER BY "id" FOR UPDATE`;
        }
        const busyStore = await tx.store.findFirst({
          where: {
            workspace: { ownerId: userId },
            OR: [
              {
                channelConnections: {
                  some: {
                    OR: [
                      { processingStartedAt: { not: null } },
                      { questionSyncStartedAt: { not: null } },
                    ],
                  },
                },
              },
              {
                questionAnswers: {
                  some: { status: { in: ['QUEUED', 'PROCESSING'] } },
                },
              },
              {
                productQuestions: {
                  some: {
                    draftProcessingStatus: { in: ['QUEUED', 'PROCESSING'] },
                  },
                },
              },
            ],
          },
          select: { id: true },
        });
        if (busyStore) {
          throw new ConflictException(
            'Kuyruktaki taslaklar, senkronizasyonlar ve cevap gönderimleri tamamlanmadan hesap silinemez.',
          );
        }

        for (const entry of inspection.entries) {
          if (!entry.customerIds.length && !entry.transactions.length) continue;
          // An independent, minimal audit record, not an undeleted user profile.
          await tx.billingClosureRecord.create({
            data: {
              workspaceReference: entry.workspace.id,
              environment: paddleCheckoutEnvironment(),
              paddleSubscriptionIds: entry.subscriptions.map(
                (subscription) => subscription.id,
              ),
              paddleCustomerIds: entry.customerIds,
              billingSnapshot: {
                version: 1,
                verifiedAt: inspection.checkedAt,
                subscriptions: entry.subscriptions.map((subscription) => ({
                  id: subscription.id,
                  customerId: subscription.customerId,
                  status: subscription.status,
                  canceledAt: subscription.canceledAt,
                })),
                transactions: entry.transactions.map((transaction) => ({
                  id: transaction.id,
                  status: transaction.status,
                  subscriptionId: transaction.subscriptionId,
                  currency: transaction.currencyCode,
                  total: transaction.details?.totals?.grandTotal ?? null,
                })),
                checkouts: entry.workspace.billingCheckouts.map((checkout) => ({
                  id: checkout.id,
                  plan: checkout.plan,
                  cycle: checkout.cycle,
                  priceId: checkout.paddlePriceId,
                  transactionId: checkout.paddleTransactionId,
                })),
                planChanges: entry.workspace.billingPlanChanges
                  .filter((change) => change.submittedAt)
                  .map((change) => ({
                    id: change.id,
                    subscriptionId: change.paddleSubscriptionId,
                    sourcePriceId: change.sourcePriceId,
                    targetPriceId: change.targetPriceId,
                    status: change.status,
                    submittedAt: change.submittedAt?.toISOString(),
                  })),
              },
            },
          });
        }
        // Session/account/workspace cascades happen atomically with the archive.
        await tx.user.delete({ where: { id: userId } });
        await this.audit.record(
          {
            actorType: AuditActorType.USER,
            actorUserId: userId,
            origin: AuditOrigin.API,
            action: AuditAction.ACCOUNT_DELETED,
            result: AuditResult.SUCCESS,
            targetType: 'USER_ACCOUNT',
            targetId: userId,
            after: {
              deleted: true,
              workspaceCount: locked.length,
              billingClosureRecordsRetained: inspection.entries.filter(
                (entry) =>
                  entry.customerIds.length > 0 || entry.transactions.length > 0,
              ).length,
            },
          },
          tx,
        );
      },
      { timeout: 15_000 },
    );
    return { success: true };
  }

  private async assertFreshSession(
    userId: string,
    sessionId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const session = await db.session.findFirst({
      where: { id: sessionId, userId, expiresAt: { gt: new Date() } },
      select: { createdAt: true },
    });
    if (!session || Date.now() - session.createdAt.getTime() > 60 * 60 * 1000) {
      throw new ForbiddenException(
        'Güvenliğiniz için çıkış yapıp yeniden giriş yaptıktan sonra bu işlemi tekrar deneyin.',
      );
    }
  }

  private loadWorkspaces(
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    // Membership in somebody else's workspace does not authorize cancellation.
    return db.workspace.findMany({
      where: { ownerId: userId },
      include: workspaceInclude,
      orderBy: { id: 'asc' },
    });
  }

  private async inspect(userId: string) {
    const workspaces = await this.loadWorkspaces(userId);
    try {
      const entries: WorkspaceInspection[] = [];
      for (const workspace of workspaces)
        entries.push(await this.inspectWorkspace(workspace));
      return { workspaces, entries, checkedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error({
        message:
          'Account deletion billing verification unavailable; deletion denied.',
        userId,
      });
      throw new ServiceUnavailableException(
        'Paddle ödeme durumu doğrulanamadı. Güvenliğiniz için hesap silme kapalı; lütfen tekrar deneyin.',
      );
    }
  }

  private async inspectWorkspace(
    workspace: Workspace,
  ): Promise<WorkspaceInspection> {
    const issues: string[] = [];
    if (
      workspace.billingPlanChanges.some((change) =>
        PENDING_PLAN_CHANGE_STATUSES.includes(change.status),
      )
    ) {
      issues.push(
        'Bekleyen plan değişikliği var. Webhook doğrulaması veya destek incelemesi tamamlanmadan hesap silinemez.',
      );
    }
    const transactions = new Map<string, Transaction>();
    const subscriptions = new Map<string, Subscription>();
    const cancelableTransactions = new Set<string>();
    const knownCheckoutTransactionIds = new Set<string>();
    const customerIds = new Set<string>();
    const knownSubscriptionIds = new Set<string>();
    const localSubscription = workspace.billingSubscription;
    if (localSubscription?.paddleSubscriptionId)
      knownSubscriptionIds.add(localSubscription.paddleSubscriptionId);
    if (localSubscription?.paddleCustomerId)
      customerIds.add(localSubscription.paddleCustomerId);
    for (const checkout of workspace.billingCheckouts) {
      if (checkout.paddleTransactionId)
        knownCheckoutTransactionIds.add(checkout.paddleTransactionId);
      if (checkout.paddleSubscriptionId)
        knownSubscriptionIds.add(checkout.paddleSubscriptionId);
      if (checkout.previousPaddleSubscriptionId)
        knownSubscriptionIds.add(checkout.previousPaddleSubscriptionId);
    }
    if (
      localSubscription &&
      !localSubscription.paddleSubscriptionId &&
      !['TRIALING', 'EXPIRED'].includes(localSubscription.status)
    ) {
      issues.push(
        'Abonelik kaydı Paddle ile eşleştirilmeli. Destek ile iletişime geçin.',
      );
    }
    for (const checkout of workspace.billingCheckouts) {
      if (checkout.environment !== paddleCheckoutEnvironment()) {
        throw new ConflictException(
          'Hesapta farklı Paddle ortamına ait ödeme kayıtları var; önce bu kayıtlar doğrulanmalı.',
        );
      }
      if (['CREATING', 'REVIEW_REQUIRED'].includes(checkout.status)) {
        issues.push(
          'Sonucu henüz kesinleşmeyen bir ödeme var. İşlemin tamamlanmasını bekleyin veya desteğe başvurun.',
        );
        continue;
      }
      if (!checkout.paddleTransactionId) {
        if (checkout.status !== 'FAILED')
          issues.push('Ödeme referansı eksik; destek incelemesi gerekiyor.');
        continue;
      }
      const remote = await this.getClient().transactions.get(
        checkout.paddleTransactionId,
      );
      if (
        remote.id !== checkout.paddleTransactionId ||
        (checkout.expectedPaddleCustomerId &&
          remote.customerId !== checkout.expectedPaddleCustomerId) ||
        remote.items.length !== 1 ||
        remote.items[0]?.quantity !== 1 ||
        remote.items[0]?.price?.id !== checkout.paddlePriceId
      ) {
        throw new ConflictException(
          'Ödeme kimliği doğrulanamadı; hesap silinmedi. Destek incelemesi gerekiyor.',
        );
      }
      transactions.set(remote.id, remote);
      if (remote.customerId) customerIds.add(remote.customerId);
      if (
        remote.subscriptionId &&
        !knownSubscriptionIds.has(remote.subscriptionId)
      ) {
        issues.push(
          'Ödemenin abonelik bağlantısı henüz doğrulanmadı. Webhook işlemini bekleyin.',
        );
      }
      if (
        (remote.status === 'draft' || remote.status === 'ready') &&
        !remote.subscriptionId &&
        !checkout.boundAt
      ) {
        cancelableTransactions.add(remote.id);
      }
    }
    for (const id of knownSubscriptionIds) {
      const remote = await this.getClient().subscriptions.get(id);
      if (
        remote.id !== id ||
        (localSubscription?.paddleCustomerId &&
          remote.customerId !== localSubscription.paddleCustomerId)
      ) {
        throw new ConflictException(
          'Abonelik sahipliği doğrulanamadı; hesap silinmedi.',
        );
      }
      customerIds.add(remote.customerId);
      subscriptions.set(remote.id, remote);
    }
    for (const customerId of customerIds) {
      // Detect legacy/duplicate subscriptions not present in our local mapping.
      const active = this.getClient().subscriptions.list({
        customerId: [customerId],
        status: ['active', 'trialing', 'paused', 'past_due'],
        perPage: 30,
      });
      for await (const subscription of active) {
        if (!knownSubscriptionIds.has(subscription.id))
          issues.push(
            'Paddle hesabında eşleştirilmemiş bir abonelik var; destek incelemesi gerekiyor.',
          );
        else subscriptions.set(subscription.id, subscription);
      }
      const outstanding = this.getClient().transactions.list({
        customerId: [customerId],
        status: ['draft', 'ready', 'billed', 'past_due', 'paid'],
        perPage: 30,
      });
      for await (const transaction of outstanding) {
        if (transaction.customerId !== customerId) {
          throw new ConflictException(
            'Ödeme müşterisi doğrulanamadı; hesap silinmedi. Destek incelemesi gerekiyor.',
          );
        }
        transactions.set(transaction.id, transaction);

        // Older checkout attempts may predate the local BillingCheckout
        // reservation table. The persisted, unique Paddle customer mapping is
        // authoritative for account closure, so an unbound standalone payment
        // for that exact customer can be canceled safely. Never infer this
        // ownership from client-controlled customData, and never cancel a
        // subscription transaction or a payment that progressed past `ready`.
        if (
          !knownCheckoutTransactionIds.has(transaction.id) &&
          isCancelableStandaloneTransaction(transaction)
        ) {
          cancelableTransactions.add(transaction.id);
        }
      }
    }
    for (const transaction of transactions.values()) {
      if (
        transaction.status === 'completed' ||
        transaction.status === 'canceled' ||
        cancelableTransactions.has(transaction.id)
      )
        continue;
      issues.push(
        'Sonuçlanmamış veya ödenmemiş bir işlem var. Fatura/ödeme kesinleşmeden hesap silinemez.',
      );
    }
    return {
      workspace,
      issues: [...new Set(issues)],
      subscriptions: [...subscriptions.values()],
      transactions: [...transactions.values()],
      customerIds: [...customerIds],
      cancelableTransactions: [...cancelableTransactions],
    };
  }

  private summary(inspection: Inspection) {
    const workspaces = inspection.entries.map((entry) => ({
      id: entry.workspace.id,
      name: entry.workspace.name,
      issues: entry.issues,
      subscriptions: entry.subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        cancelScheduled: subscription.scheduledChange?.action === 'cancel',
        accessEndsAt:
          subscription.status === 'canceled'
            ? subscription.canceledAt
            : (subscription.scheduledChange?.effectiveAt ??
              subscription.currentBillingPeriod?.endsAt ??
              null),
      })),
      pendingPaymentCount: entry.transactions.filter(
        (transaction) =>
          !['completed', 'canceled'].includes(transaction.status),
      ).length,
    }));
    const canResolveBilling = inspection.entries.some(
      (entry) =>
        entry.cancelableTransactions.length > 0 ||
        entry.subscriptions.some(
          (subscription) => subscription.status !== 'canceled',
        ),
    );
    return {
      checkedAt: inspection.checkedAt,
      canDelete:
        !canResolveBilling &&
        inspection.entries.every((entry) => entry.issues.length === 0),
      canResolveBilling,
      workspaces,
    };
  }

  private getClient() {
    this.client ??= new Paddle(requirePaddleApiKey(), {
      environment: paddleEnvironment(),
    });
    return this.client;
  }
}

function isCancelableStandaloneTransaction(transaction: Transaction) {
  return (
    (transaction.status === 'draft' || transaction.status === 'ready') &&
    !transaction.subscriptionId
  );
}
