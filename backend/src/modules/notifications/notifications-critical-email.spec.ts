import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsService } from './notifications.service';
import { OperationalEmailIncidentService } from './operational-email-incident.service';
import { SyncEmailIncidentService } from './sync-email-incident.service';

function createHarness() {
  const staged: Array<{ recipientUserId: string; type: NotificationType }> = [];
  const transaction = {
    workspace: {
      findUnique: () =>
        Promise.resolve({
          ownerId: 'owner-1',
          members: [{ userId: 'finance-admin-1' }],
        }),
    },
    notification: {
      createMany: () => Promise.resolve({ count: 2 }),
      findMany: () =>
        Promise.resolve([
          { id: 'notice-owner', recipientUserId: 'owner-1' },
          { id: 'notice-admin', recipientUserId: 'finance-admin-1' },
        ]),
      upsert: () =>
        Promise.resolve({ id: 'security-notice', recipientUserId: 'user-1' }),
    },
  };
  const prisma = {
    $transaction: (run: (client: typeof transaction) => Promise<unknown>) =>
      run(transaction),
  };
  const delivery = {
    stageEssentialEmail: (
      _transaction: unknown,
      _notificationId: string,
      input: { recipientUserId: string; type: NotificationType },
    ) => {
      staged.push({ recipientUserId: input.recipientUserId, type: input.type });
      return Promise.resolve();
    },
  };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    { emit: () => undefined } as unknown as NotificationStreamService,
    delivery as unknown as NotificationDeliveryService,
    {} as SyncEmailIncidentService,
    {} as OperationalEmailIncidentService,
  );
  return {
    service,
    transaction: transaction as unknown as Prisma.TransactionClient,
    staged,
  };
}

void test('confirmed payment failure emails only workspace finance recipients', async () => {
  const { service, transaction, staged } = createHarness();
  const recipients = await service.createBillingIssue(
    transaction,
    'workspace-1',
    {
      title: 'Payment failed',
      message: 'Update your payment method.',
      dedupeKey: 'payment:subscription-1:period-1',
      confirmedFailure: true,
    },
  );
  assert.deepEqual(recipients, ['owner-1', 'finance-admin-1']);
  assert.deepEqual(staged, [
    {
      recipientUserId: 'owner-1',
      type: NotificationType.BILLING_PAYMENT_ISSUE,
    },
    {
      recipientUserId: 'finance-admin-1',
      type: NotificationType.BILLING_PAYMENT_ISSUE,
    },
  ]);
});

void test('unverified renewal remains in-app only', async () => {
  const { service, transaction, staged } = createHarness();
  await service.createBillingIssue(transaction, 'workspace-1', {
    title: 'Renewal pending',
    message: 'The renewal is being checked.',
    dedupeKey: 'renewal:subscription-1:period-1',
  });
  assert.deepEqual(staged, []);
});

void test('subscription and refund confirmations use the finance email path', async () => {
  for (const type of [
    NotificationType.BILLING_SUBSCRIPTION_CHANGED,
    NotificationType.BILLING_CANCELLATION,
    NotificationType.BILLING_REFUND,
  ]) {
    const { service, transaction, staged } = createHarness();
    await service.createForUsersInTransaction(transaction, {
      recipientUserIds: ['owner-1', 'finance-admin-1'],
      type,
      severity: NotificationSeverity.INFO,
      title: 'Billing updated',
      message: 'Review billing details.',
      dedupeKey: `billing:${type}`,
    });
    assert.deepEqual(
      staged.map((entry) => entry.type),
      [type, type],
    );
  }
});

void test('security change emails only the affected account', async () => {
  for (const type of [
    NotificationType.SECURITY_ACCOUNT_CHANGED,
    NotificationType.SECURITY_SESSIONS_REVOKED,
  ]) {
    const { service, staged } = createHarness();
    await service.createForUser({
      recipientUserId: 'user-1',
      type,
      severity: NotificationSeverity.WARNING,
      title: 'Account security changed',
      message: 'Review your account.',
      dedupeKey: `security:${type}`,
    });
    assert.deepEqual(staged, [{ recipientUserId: 'user-1', type }]);
  }
});
