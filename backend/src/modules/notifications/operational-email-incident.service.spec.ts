import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import {
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
  NotificationType,
  OperationalEmailIncidentKind,
  OperationalEmailIncidentStatus,
  OperationalEmailPhase,
  StoreStatus,
  SyncEmailDeliveryStatus,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import { entitlementsFor } from '../billing/billing-plan.config';
import { OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS } from './operational-email-incident.policy';
import { OperationalEmailIncidentService } from './operational-email-incident.service';

function createHarness() {
  const incidents = new Map<
    string,
    {
      id: string;
      storeId: string;
      connectionId: string | null;
      scopeKey: string;
      kind: OperationalEmailIncidentKind;
      status: OperationalEmailIncidentStatus;
      failureCount: number;
      lastEmailedFailureCount: number;
      openedAt: Date;
      lastFailureAt: Date;
      recoveryCandidateAt: Date | null;
      resolvedAt: Date | null;
      openedEmailAt: Date | null;
      lastEmailAt: Date | null;
      resolvedEmailAt: Date | null;
      claimToken: string | null;
      claimUntil: Date | null;
    }
  >();
  const deliveries = new Map<
    string,
    {
      id: string;
      incidentId: string;
      recipientUserId: string;
      phase: OperationalEmailPhase;
      sequence: number;
      status: SyncEmailDeliveryStatus;
      claimToken: string | null;
      claimUntil: Date | null;
      sentAt: Date | null;
    }
  >();
  const emails: Array<{
    key: string;
    message: string;
    type: string;
    url: string;
  }> = [];
  const subscription = {
    plan: BillingPlan.STARTER as BillingPlan,
    status: BillingSubscriptionStatus.ACTIVE as BillingSubscriptionStatus,
    cycle: BillingCycle.MONTHLY,
    currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
    usagePeriodAnchor: null,
    trialEndsAt: null,
    scheduledAccessEndsAt: null,
    paddleSubscriptionId: 'sub-1',
    cancelAtPeriodEnd: false,
  };
  const quota = {
    used: entitlementsFor(subscription.plan, subscription.status)
      .monthlyAiQuestions,
  };
  const store = {
    name: 'Test mağazası',
    status: StoreStatus.ACTIVE,
    members: [],
    workspace: { ownerId: 'owner-1', members: [] },
  };
  const incidentModel = {
    findFirst: (query: {
      where: {
        storeId: string;
        kind: OperationalEmailIncidentKind;
        scopeKey: string;
        status: OperationalEmailIncidentStatus;
        recoveryCandidateAt?: null;
      };
    }) =>
      Promise.resolve(
        [...incidents.values()].find(
          (item) =>
            item.storeId === query.where.storeId &&
            item.kind === query.where.kind &&
            item.scopeKey === query.where.scopeKey &&
            item.status === query.where.status &&
            (query.where.recoveryCandidateAt !== null ||
              item.recoveryCandidateAt === null),
        ) ?? null,
      ),
    findUnique: (query: { where: { id: string }; include?: unknown }) => {
      const incident = incidents.get(query.where.id);
      return Promise.resolve(
        incident ? { ...incident, ...(query.include ? { store } : {}) } : null,
      );
    },
    findMany: () => Promise.resolve([...incidents.values()]),
    create: (query: { data: Record<string, unknown> }) => {
      const now = new Date();
      const incident = {
        id: `incident-${incidents.size + 1}`,
        storeId: query.data.storeId as string,
        connectionId: (query.data.connectionId as string | null) ?? null,
        scopeKey: query.data.scopeKey as string,
        kind: query.data.kind as OperationalEmailIncidentKind,
        status: OperationalEmailIncidentStatus.OPEN,
        failureCount: 1,
        lastEmailedFailureCount: 0,
        openedAt: now,
        lastFailureAt: now,
        recoveryCandidateAt: null,
        resolvedAt: null,
        openedEmailAt: null,
        lastEmailAt: null,
        resolvedEmailAt: null,
        claimToken: null,
        claimUntil: null,
      };
      incidents.set(incident.id, incident);
      return Promise.resolve(incident);
    },
    update: (query: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const incident = incidents.get(query.where.id)!;
      applyUpdate(incident, query.data);
      return Promise.resolve(incident);
    },
    updateMany: (query: {
      where: {
        id?: string;
        storeId?: string;
        kind?: OperationalEmailIncidentKind;
        connectionId?: string;
        status?: OperationalEmailIncidentStatus;
        scopeKey?: { not: string };
        claimToken?: string;
      };
      data: Record<string, unknown>;
    }) => {
      let count = 0;
      for (const incident of incidents.values()) {
        const where = query.where;
        if (where.id && incident.id !== where.id) continue;
        if (where.storeId && incident.storeId !== where.storeId) continue;
        if (where.kind && incident.kind !== where.kind) continue;
        if (where.connectionId && incident.connectionId !== where.connectionId)
          continue;
        if (where.status && incident.status !== where.status) continue;
        if (where.scopeKey && incident.scopeKey === where.scopeKey.not)
          continue;
        if (where.claimToken && incident.claimToken !== where.claimToken)
          continue;
        applyUpdate(incident, query.data);
        count += 1;
      }
      return Promise.resolve({ count });
    },
    deleteMany: () => Promise.resolve({ count: 0 }),
  };
  const deliveryModel = {
    upsert: (query: {
      where: {
        incidentId_recipientUserId_phase_sequence: {
          incidentId: string;
          recipientUserId: string;
          phase: OperationalEmailPhase;
          sequence: number;
        };
      };
    }) => {
      const values = query.where.incidentId_recipientUserId_phase_sequence;
      const id = `${values.incidentId}:${values.recipientUserId}:${values.phase}:${values.sequence}`;
      let delivery = deliveries.get(id);
      if (!delivery) {
        delivery = {
          id,
          ...values,
          status: SyncEmailDeliveryStatus.PENDING,
          claimToken: null,
          claimUntil: null,
          sentAt: null,
        };
        deliveries.set(id, delivery);
      }
      return Promise.resolve({ ...delivery });
    },
    updateMany: (query: {
      where: { id: string; claimToken?: string };
      data: Record<string, unknown>;
    }) => {
      const delivery = deliveries.get(query.where.id);
      if (
        !delivery ||
        (query.where.claimToken &&
          delivery.claimToken !== query.where.claimToken)
      )
        return Promise.resolve({ count: 0 });
      applyUpdate(delivery, query.data);
      return Promise.resolve({ count: 1 });
    },
    findMany: () =>
      Promise.resolve(
        [...deliveries.values()]
          .filter(
            (delivery) => delivery.status === SyncEmailDeliveryStatus.SENT,
          )
          .map((delivery) => ({ recipientUserId: delivery.recipientUserId })),
      ),
  };
  const transaction = {
    $queryRaw: () => Promise.resolve([{ id: 'store-1' }]),
    operationalEmailIncident: incidentModel,
    store: {
      findUnique: () =>
        Promise.resolve({
          workspaceId: 'workspace-1',
          workspace: { billingSubscription: subscription },
        }),
    },
    billingUsagePeriod: {
      findUnique: () => Promise.resolve({ aiQuestionUnits: quota.used }),
    },
    billingPlanChange: {
      findFirst: () => Promise.resolve(null),
    },
  };
  const prisma = {
    ...transaction,
    $transaction: (run: (client: typeof transaction) => Promise<unknown>) =>
      run(transaction),
    operationalEmailDelivery: deliveryModel,
    channelConnection: {
      findUnique: () => Promise.resolve({ providerKey: 'trendyol' }),
    },
  };
  const delivery = {
    emailConfigured: true,
    sendSyncIncidentEmail: (
      _userId: string,
      _storeId: string,
      type: string,
      _title: string,
      message: string,
      url: string,
      key: string,
    ) => {
      emails.push({ key, message, type, url });
      return Promise.resolve('SENT');
    },
  };
  const queue = { add: () => Promise.resolve() };
  const service = new OperationalEmailIncidentService(
    prisma as unknown as PrismaService,
    delivery as unknown as NotificationDeliveryService,
    queue as unknown as Queue,
  );
  return { service, incidents, emails, subscription, quota };
}

function applyUpdate(target: object, data: Record<string, unknown>) {
  const record = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    record[key] =
      typeof value === 'object' && value !== null && 'increment' in value
        ? Number(record[key]) + Number(value.increment)
        : value;
  }
}

void test('ilk hata tek mail, yeni hatalar sekiz saat sonra tek özet üretir', async () => {
  const { service, incidents, emails } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_DRAFT,
  };
  await service.recordFailure(input);
  const incident = [...incidents.values()][0];
  await service.processIncident(incident.id);
  await service.processIncident(incident.id);
  assert.equal(emails.length, 1);

  await service.recordFailure(input);
  await service.recordFailure(input);
  await service.processIncident(incident.id);
  assert.equal(emails.length, 1);

  incident.lastEmailAt = new Date(
    Date.now() - OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS - 1_000,
  );
  await service.processIncident(incident.id);
  await service.processIncident(incident.id);
  assert.equal(emails.length, 2);
  assert.match(emails[1].message, /2 soruda daha/);
  assert.notEqual(emails[0].key, emails[1].key);
});

void test('başarılı işlem sonrası sessiz dönemde bir kapanış maili gönderir', async () => {
  const { service, incidents, emails } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_DRAFT,
  };
  await service.recordFailure(input);
  const incident = [...incidents.values()][0];
  await service.processIncident(incident.id);
  await service.recordSuccess(input);
  incident.lastFailureAt = new Date(Date.now() - 10 * 60_000);
  incident.recoveryCandidateAt = new Date(Date.now() - 6 * 60_000);
  await service.processIncident(incident.id);
  await service.processIncident(incident.id);
  assert.equal(incident.status, OperationalEmailIncidentStatus.RESOLVED);
  assert.equal(emails.length, 2);
  assert.match(emails[1].message, /yeniden başarıyla/);
});

void test('cevap hatalarını kanal bazında ayrı olaylarda toplar', async () => {
  const { service, incidents } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.ANSWER_DELIVERY,
  };
  await service.recordFailure({ ...input, connectionId: 'trendyol-1' });
  await service.recordFailure({ ...input, connectionId: 'trendyol-1' });
  await service.recordFailure({ ...input, connectionId: 'hepsiburada-1' });
  assert.equal(incidents.size, 2);
  assert.deepEqual(
    [...incidents.values()].map((incident) => incident.failureCount),
    [2, 1],
  );
});

void test('iyileşme beklerken yeni hata gelirse kapanış maili göndermez', async () => {
  const { service, incidents, emails } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_DRAFT,
  };
  await service.recordFailure(input);
  const incident = [...incidents.values()][0];
  await service.processIncident(incident.id);
  await service.recordSuccess(input);
  await service.recordFailure(input);
  incident.lastFailureAt = new Date(Date.now() - 10 * 60_000);
  await service.processIncident(incident.id);
  assert.equal(incident.status, OperationalEmailIncidentStatus.OPEN);
  assert.equal(incident.recoveryCandidateAt, null);
  assert.equal(emails.length, 1);
});

void test('aynı kapsam yeniden bozulduysa eski olay için kapanış maili göndermez', async () => {
  const { service, incidents, emails } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_DRAFT,
  };
  await service.recordFailure(input);
  const oldIncident = [...incidents.values()][0];
  await service.processIncident(oldIncident.id);
  oldIncident.status = OperationalEmailIncidentStatus.RESOLVED;
  await service.recordFailure(input);
  await service.processIncident(oldIncident.id);
  assert.equal(incidents.size, 2);
  assert.equal(emails.length, 1);
  assert.ok(oldIncident.resolvedEmailAt);
});

void test('quota warning sends once until usage drops and then allows a new incident', async () => {
  const { service, incidents, emails, quota } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_QUOTA_PAUSED,
  };
  await service.recordFailure(input);
  const first = [...incidents.values()][0];
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].type, NotificationType.AI_AUTOMATION_PAUSED);
  assert.equal(emails[0].url, '/billing');

  await service.recordFailure(input);
  first.lastEmailAt = new Date(
    Date.now() - OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS - 1_000,
  );
  await service.resolveWarning(input);
  assert.equal(first.status, OperationalEmailIncidentStatus.OPEN);
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);

  quota.used = 0;
  await service.processIncident(first.id);
  assert.equal(first.status, OperationalEmailIncidentStatus.RESOLVED);
  assert.equal(emails.length, 1);

  quota.used = entitlementsFor(
    BillingPlan.STARTER,
    BillingSubscriptionStatus.ACTIVE,
  ).monthlyAiQuestions;
  await service.recordFailure(input);
  const second = [...incidents.values()][1];
  await service.processIncident(second.id);
  assert.equal(emails.length, 2);
  assert.notEqual(emails[0].key, emails[1].key);
});

void test('billing warning closes after access returns and can recur', async () => {
  const { service, incidents, emails, subscription } = createHarness();
  const input = {
    storeId: 'store-1',
    kind: OperationalEmailIncidentKind.AI_BILLING_PAUSED,
  };
  subscription.status = BillingSubscriptionStatus.PAST_DUE;
  await service.recordFailure(input);
  const first = [...incidents.values()][0];
  await service.processIncident(first.id);
  await service.recordFailure(input);
  await service.resolveWarning(input);
  assert.equal(first.status, OperationalEmailIncidentStatus.OPEN);
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);

  subscription.status = BillingSubscriptionStatus.PAUSED;
  await service.recordFailure(input);
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);
  assert.equal(incidents.size, 1);

  subscription.status = BillingSubscriptionStatus.ACTIVE;
  await service.processIncident(first.id);
  assert.equal(first.status, OperationalEmailIncidentStatus.RESOLVED);

  subscription.status = BillingSubscriptionStatus.PAST_DUE;
  await service.recordFailure(input);
  const second = [...incidents.values()][1];
  await service.processIncident(second.id);
  assert.equal(emails.length, 2);
});

void test('product capacity warning is scoped to the channel and resets after a clean sync', async () => {
  const { service, incidents, emails, subscription } = createHarness();
  const input = {
    storeId: 'store-1',
    connectionId: 'trendyol-1',
    kind: OperationalEmailIncidentKind.PRODUCT_CAPACITY,
  };
  await service.recordFailure(input);
  const first = [...incidents.values()][0];
  await service.processIncident(first.id);
  await service.recordFailure(input);
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].type, NotificationType.BILLING_PLAN_LIMIT);

  subscription.plan = BillingPlan.GROWTH;
  await service.recordFailure(input);
  await service.processIncident(first.id);
  assert.equal(emails.length, 1);
  assert.equal(incidents.size, 1);

  await service.resolveWarning(input);
  assert.equal(first.status, OperationalEmailIncidentStatus.RESOLVED);
  await service.recordFailure(input);
  const second = [...incidents.values()][1];
  await service.processIncident(second.id);
  assert.equal(emails.length, 2);
});
