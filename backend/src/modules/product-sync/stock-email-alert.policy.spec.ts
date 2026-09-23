import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StockEmailAlertLevel } from '../../generated/prisma/enums';
import {
  stockEmailAlertLevel,
  stockEmailAlertUpdate,
} from './stock-email-alert.policy';

const now = new Date('2026-09-23T12:00:00.000Z');

void test('kritik stok ve stok tükenmesini ayrı eşik olayları olarak kaydeder', () => {
  assert.deepEqual(stockEmailAlertUpdate(null, 8, 4, now), {
    stockEmailAlertLevel: StockEmailAlertLevel.LOW_STOCK,
    stockEmailAlertStartedAt: now,
  });
  assert.deepEqual(
    stockEmailAlertUpdate(StockEmailAlertLevel.LOW_STOCK, 4, 0, now),
    {
      stockEmailAlertLevel: StockEmailAlertLevel.OUT_OF_STOCK,
      stockEmailAlertStartedAt: now,
    },
  );
});

void test('düşük stokta kaldığı sürece aynı varyant için yeni olay açmaz', () => {
  assert.deepEqual(
    stockEmailAlertUpdate(StockEmailAlertLevel.LOW_STOCK, 4, 2, now),
    {},
  );
  assert.deepEqual(
    stockEmailAlertUpdate(StockEmailAlertLevel.OUT_OF_STOCK, 0, 2, now),
    {},
  );
  assert.deepEqual(
    stockEmailAlertUpdate(StockEmailAlertLevel.OUT_OF_STOCK, 2, 0, now),
    {},
  );
});

void test('stok güvenli seviyeye çıkınca uyarıyı yeniden kurar', () => {
  assert.deepEqual(
    stockEmailAlertUpdate(StockEmailAlertLevel.OUT_OF_STOCK, 0, 8, now),
    { stockEmailAlertLevel: null, stockEmailAlertStartedAt: null },
  );
  assert.deepEqual(stockEmailAlertUpdate(null, 8, 0, now), {
    stockEmailAlertLevel: StockEmailAlertLevel.OUT_OF_STOCK,
    stockEmailAlertStartedAt: now,
  });
});

void test('ilk içe aktarılan kritik stokları yeni tükenme gibi saymaz', () => {
  assert.equal(stockEmailAlertLevel(0), StockEmailAlertLevel.OUT_OF_STOCK);
  assert.equal(stockEmailAlertLevel(4), StockEmailAlertLevel.LOW_STOCK);
  assert.equal(stockEmailAlertLevel(8), null);
});
