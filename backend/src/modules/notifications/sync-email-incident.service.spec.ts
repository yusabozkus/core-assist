import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import {
  ChannelConnectionStatus,
  StoreStatus,
  SyncEmailDeliveryPhase,
  SyncEmailDeliveryStatus,
  SyncEmailIncidentKind,
  SyncEmailIncidentStatus,
} from '../../generated/prisma/enums';
import { NotificationDeliveryService } from './notification-delivery.service';
import type { ChannelEmailEvent } from './email-templates/channel-email.template';
import { SyncEmailIncidentService } from './sync-email-incident.service';

function createHarness(
  openOutcome: 'SENT' | 'SKIPPED' = 'SENT',
  kind: SyncEmailIncidentKind = SyncEmailIncidentKind.INVENTORY,
) {
  const incident = {
    id: 'incident-1',
    connectionId: 'connection-1',
    kind,
    status: SyncEmailIncidentStatus.OPEN as SyncEmailIncidentStatus,
    failureCount: kind === SyncEmailIncidentKind.AUTH ? 1 : 3,
    openedAt: new Date('2026-09-23T20:00:00.000Z'),
    openEmailCompletedAt: null as Date | null,
    resolvedEmailCompletedAt: null as Date | null,
    connection: {
      storeId: 'store-1',
      providerKey: 'trendyol',
      status:
        kind === SyncEmailIncidentKind.AUTH
          ? ChannelConnectionStatus.ERROR
          : ChannelConnectionStatus.CONNECTED,
      removedAt: null,
      connectedAt: null,
      lastSyncAt: null,
      lastInventorySyncAt: null as Date | null,
      lastQuestionSyncAt: null,
      store: {
        name: 'Test mağaza',
        status: StoreStatus.ACTIVE,
        members: [],
        workspace: { ownerId: 'owner-1', members: [] },
      },
    },
  };
  const records = new Map<
    string,
    {
      id: string;
      phase: SyncEmailDeliveryPhase;
      recipientUserId: string;
      status: SyncEmailDeliveryStatus;
      claimToken: string | null;
      claimUntil: Date | null;
      sentAt: Date | null;
    }
  >();
  const emails: Array<{
    phase: SyncEmailDeliveryPhase;
    key: string;
    url: string;
    message: string;
    event: ChannelEmailEvent | undefined;
  }> = [];
  const prisma = {
    syncEmailIncident: {
      findUnique: () => Promise.resolve(incident),
      findFirst: () => Promise.resolve(null),
      updateMany: (query: { data: Record<string, unknown> }) => {
        Object.assign(incident, query.data);
        return Promise.resolve({ count: 1 });
      },
    },
    syncEmailIncidentDelivery: {
      findMany: () =>
        Promise.resolve(
          [...records.values()]
            .filter(
              (record) =>
                record.phase === SyncEmailDeliveryPhase.OPEN &&
                record.status === SyncEmailDeliveryStatus.SENT,
            )
            .map((record) => ({ recipientUserId: record.recipientUserId })),
        ),
      upsert: (query: {
        where: {
          incidentId_recipientUserId_phase: {
            recipientUserId: string;
            phase: SyncEmailDeliveryPhase;
          };
        };
        create: { status?: SyncEmailDeliveryStatus };
        update: { status?: SyncEmailDeliveryStatus };
      }) => {
        const { recipientUserId, phase } =
          query.where.incidentId_recipientUserId_phase;
        const key = `${recipientUserId}:${phase}`;
        const existing = records.get(key);
        if (existing) {
          Object.assign(existing, query.update);
          return Promise.resolve({ ...existing });
        }
        const created = {
          id: key,
          recipientUserId,
          phase,
          status: query.create.status ?? SyncEmailDeliveryStatus.PENDING,
          claimToken: null,
          claimUntil: null,
          sentAt: null,
        };
        records.set(key, created);
        return Promise.resolve({ ...created });
      },
      updateMany: (query: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const record = records.get(query.where.id);
        if (!record) return Promise.resolve({ count: 0 });
        Object.assign(record, query.data);
        return Promise.resolve({ count: 1 });
      },
    },
  };
  const delivery = {
    emailConfigured: true,
    sendSyncIncidentEmail: (
      _userId: string,
      _storeId: string,
      _type: string,
      _title: string,
      message: string,
      url: string,
      key: string,
      templates: { channel?: ChannelEmailEvent } | undefined,
    ) => {
      const phase =
        incident.status === SyncEmailIncidentStatus.OPEN
          ? SyncEmailDeliveryPhase.OPEN
          : SyncEmailDeliveryPhase.RESOLVED;
      emails.push({ phase, key, url, message, event: templates?.channel });
      return Promise.resolve(
        phase === SyncEmailDeliveryPhase.OPEN ? openOutcome : 'SENT',
      );
    },
  };
  const service = new SyncEmailIncidentService(
    prisma as unknown as PrismaService,
    delivery as unknown as NotificationDeliveryService,
    {} as Queue,
  );
  return { service, incident, emails };
}

void test('cevap gönderiminden kaynaklanan kanal yetkilendirme olayı hemen mail gönderir', async () => {
  const { service, incident, emails } = createHarness(
    'SENT',
    SyncEmailIncidentKind.AUTH,
  );
  await service.processIncident(incident.id);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].phase, SyncEmailDeliveryPhase.OPEN);
  assert.equal(emails[0].url, '/dashboard/channels');
  assert.match(emails[0].message, /cevap gönderimi/i);
  assert.deepEqual(emails[0].event, {
    providerKey: 'trendyol',
    storeName: 'Test mağaza',
    kind: SyncEmailIncidentKind.AUTH,
    phase: SyncEmailDeliveryPhase.OPEN,
  });
});

void test('aynı arıza için tek açılış ve düzelince tek kapanış e-postası gönderir', async () => {
  const { service, incident, emails } = createHarness();
  await service.processIncident(incident.id);
  await service.processIncident(incident.id);
  assert.deepEqual(
    emails.map((email) => email.phase),
    [SyncEmailDeliveryPhase.OPEN],
  );

  incident.status = SyncEmailIncidentStatus.RESOLVED;
  await service.processIncident(incident.id);
  await service.processIncident(incident.id);
  assert.deepEqual(
    emails.map((email) => email.phase),
    [SyncEmailDeliveryPhase.OPEN, SyncEmailDeliveryPhase.RESOLVED],
  );
  assert.notEqual(emails[0].key, emails[1].key);
  assert.equal(emails[1].event?.phase, SyncEmailDeliveryPhase.RESOLVED);
});

void test('açılış e-postası gönderilmediyse düzelme e-postası da göndermez', async () => {
  const { service, incident, emails } = createHarness('SKIPPED');
  await service.processIncident(incident.id);
  incident.status = SyncEmailIncidentStatus.RESOLVED;
  await service.processIncident(incident.id);
  assert.deepEqual(
    emails.map((email) => email.phase),
    [SyncEmailDeliveryPhase.OPEN],
  );
});

void test('başarılı stok senkronizasyonu sonrası kapanış kaçmışsa eski sorun mailini göndermez', async () => {
  const { service, incident, emails } = createHarness();
  let resolved = false;
  service.resolve = () => {
    resolved = true;
    return Promise.resolve();
  };
  incident.connection.lastInventorySyncAt = new Date(
    incident.openedAt.getTime() + 60_000,
  );
  await service.processIncident(incident.id);
  assert.equal(resolved, true);
  assert.equal(emails.length, 0);
});

void test('aynı senkronizasyon çalışmasını iki kez saymaz ve üçüncü farklı hatada tek olay açar', async () => {
  const state = {
    id: 'incident-1',
    failureCount: 1,
    lastRunId: 'run-1',
    openEmailCompletedAt: null,
  };
  const queued: string[] = [];
  const transaction = {
    $queryRaw: () => Promise.resolve([{ id: 'connection-1' }]),
    syncEmailIncident: {
      findFirst: (query: { where: { kind: SyncEmailIncidentKind } }) =>
        Promise.resolve(
          query.where.kind === SyncEmailIncidentKind.AUTH ? null : { ...state },
        ),
      update: (query: {
        data: { lastRunId: string; failureCount: { increment: number } };
      }) => {
        state.failureCount += query.data.failureCount.increment;
        state.lastRunId = query.data.lastRunId;
        return Promise.resolve({ ...state });
      },
    },
  };
  const prisma = {
    $transaction: (run: (client: typeof transaction) => Promise<unknown>) =>
      run(transaction),
  };
  const queue = {
    add: (_name: string, data: { incidentId: string }) => {
      queued.push(data.incidentId);
      return Promise.resolve();
    },
  };
  const service = new SyncEmailIncidentService(
    prisma as unknown as PrismaService,
    {} as NotificationDeliveryService,
    queue as unknown as Queue,
  );
  const input = {
    storeId: 'store-1',
    connectionId: 'connection-1',
    kind: SyncEmailIncidentKind.QUESTION,
  };
  await service.recordFailure({ ...input, runId: 'run-1' });
  await service.recordFailure({ ...input, runId: 'run-2' });
  await service.recordFailure({ ...input, runId: 'run-3' });
  await service.recordFailure({ ...input, runId: 'run-3' });
  assert.equal(state.failureCount, 3);
  assert.deepEqual(queued, ['incident-1']);
});
