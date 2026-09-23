import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEmailDigestService } from './notification-email-digest.service';
import { StockEmailAlertLevel } from '../../generated/prisma/enums';

function createHarness(
  pendingCount: number,
  newCount: number,
  failFirst = false,
  deliveryAllowed = true,
) {
  const latestAt = new Date('2026-09-23T14:00:00.000Z');
  const state = {
    id: 'digest-1',
    lastIncludedAt: null as Date | null,
    pendingUntil: null as Date | null,
    idempotencyKey: null as string | null,
    claimToken: null as string | null,
    claimUntil: null as Date | null,
    lastSentAt: null as Date | null,
  };
  const sends: Array<{ pending: number; added: number }> = [];
  const stockSends: Array<{ current: number; added: number; type: string }> =
    [];
  const attemptKeys: string[] = [];
  const prisma = {
    notificationDeliverySetting: {
      findMany: (query: { where: { id?: unknown } }) =>
        Promise.resolve(
          query.where.id
            ? []
            : [{ id: 'setting-1', userId: 'user-1', storeId: 'store-1' }],
        ),
    },
    store: {
      findFirst: () => Promise.resolve({ id: 'store-1', name: 'Mağaza' }),
    },
    notificationPreference: { findUnique: () => Promise.resolve(null) },
    notificationEmailDigestState: {
      upsert: () => Promise.resolve({ ...state }),
      updateMany: (query: { data: Record<string, unknown> }) => {
        Object.assign(state, query.data);
        return Promise.resolve({ count: 1 });
      },
    },
    productQuestion: { count: () => Promise.resolve(pendingCount) },
    externalProductVariant: {
      count: (query: { where: { stockEmailAlertStartedAt?: unknown } }) =>
        Promise.resolve(
          query.where.stockEmailAlertStartedAt
            ? state.lastIncludedAt
              ? 0
              : newCount
            : pendingCount,
        ),
    },
    $queryRaw: () =>
      Promise.resolve([
        {
          count: state.lastIncludedAt ? 0 : newCount,
          latestAt: !state.lastIncludedAt && newCount > 0 ? latestAt : null,
        },
      ]),
  };
  const delivery = {
    emailConfigured: true,
    sendAiReviewDigest: (
      _userId: string,
      _storeId: string,
      _storeName: string,
      pending: number,
      added: number,
      key: string,
    ) => {
      attemptKeys.push(key);
      if (failFirst && attemptKeys.length === 1)
        return Promise.reject(new Error('Temporary'));
      if (!deliveryAllowed) return Promise.resolve(false);
      sends.push({ pending, added });
      return Promise.resolve(true);
    },
    sendStockDigest: (
      _userId: string,
      _storeId: string,
      _storeName: string,
      type: string,
      current: number,
      added: number,
      key: string,
    ) => {
      attemptKeys.push(key);
      if (failFirst && attemptKeys.length === 1)
        return Promise.reject(new Error('Temporary'));
      if (!deliveryAllowed) return Promise.resolve(false);
      stockSends.push({ current, added, type });
      return Promise.resolve(true);
    },
  };
  const service = new NotificationEmailDigestService(
    prisma as unknown as PrismaService,
    delivery as unknown as NotificationDeliveryService,
  );
  return { service, state, sends, stockSends, attemptKeys };
}

void test('AI inceleme sorularını tek e-postada toplar ve gönderim imlecini kaydeder', async () => {
  const { service, state, sends } = createHarness(10, 8);
  await service.sendAiReviewDigests();

  assert.deepEqual(sends, [{ pending: 10, added: 8 }]);
  assert.equal(state.lastIncludedAt?.toISOString(), '2026-09-23T14:00:00.000Z');
  assert.equal(state.pendingUntil, null);
  assert.equal(state.idempotencyKey, null);

  await service.sendAiReviewDigests();
  assert.equal(sends.length, 1);
});

void test('inceleme bekleyen soru kalmadığında e-posta göndermez', async () => {
  const { service, sends } = createHarness(0, 8);
  await service.sendAiReviewDigests();
  assert.equal(sends.length, 0);
});

void test('önceki özetten beri yeni inceleme sorusu yoksa e-posta göndermez', async () => {
  const { service, sends } = createHarness(10, 0);
  await service.sendAiReviewDigests();
  assert.equal(sends.length, 0);
});

void test('başarısız gönderimi aynı idempotency anahtarıyla yeniden dener', async () => {
  const { service, state, sends, attemptKeys } = createHarness(10, 8, true);
  await assert.rejects(service.sendAiReviewDigests());
  assert.equal(sends.length, 0);
  assert.equal(state.lastIncludedAt, null);
  assert.equal(state.pendingUntil?.toISOString(), '2026-09-23T14:00:00.000Z');

  await service.sendAiReviewDigests();
  assert.equal(sends.length, 1);
  assert.equal(attemptKeys.length, 2);
  assert.equal(attemptKeys[0], attemptKeys[1]);
});

void test('sessiz saatlerde özet penceresini tüketmez', async () => {
  const { service, state, sends } = createHarness(10, 8, false, false);
  await service.sendAiReviewDigests();
  assert.equal(sends.length, 0);
  assert.equal(state.pendingUntil, null);
  assert.equal(state.lastIncludedAt, null);
});

void test('tükenen stokları tek e-postada toplar ve eski olayları tekrarlamaz', async () => {
  const { service, state, stockSends } = createHarness(10, 3);
  await service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
  assert.deepEqual(stockSends, [
    { current: 10, added: 3, type: 'OUT_OF_STOCK' },
  ]);
  assert.ok(state.lastIncludedAt);

  await service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
  assert.equal(stockSends.length, 1);
});

void test('kritik stok özetini 24 saat dolmadan ikinci kez göndermez', async () => {
  const { service, stockSends } = createHarness(10, 3);
  await service.sendStockDigests(StockEmailAlertLevel.LOW_STOCK);
  await service.sendStockDigests(StockEmailAlertLevel.LOW_STOCK);
  assert.equal(stockSends.length, 1);
});

void test('başarısız stok e-postasını aynı idempotency anahtarıyla yeniden dener', async () => {
  const { service, state, stockSends, attemptKeys } = createHarness(
    10,
    3,
    true,
  );
  await assert.rejects(
    service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK),
  );
  assert.equal(stockSends.length, 0);
  assert.ok(state.pendingUntil);
  assert.equal(state.lastIncludedAt, null);

  await service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
  assert.equal(stockSends.length, 1);
  assert.equal(attemptKeys.length, 2);
  assert.equal(attemptKeys[0], attemptKeys[1]);
});

void test('stok düzelmişse veya sessiz saatler açıksa e-posta göndermez', async () => {
  const resolved = createHarness(10, 0);
  await resolved.service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
  assert.equal(resolved.stockSends.length, 0);

  const quiet = createHarness(10, 3, false, false);
  await quiet.service.sendStockDigests(StockEmailAlertLevel.OUT_OF_STOCK);
  assert.equal(quiet.stockSends.length, 0);
  assert.equal(quiet.state.pendingUntil, null);
});
