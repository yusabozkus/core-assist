import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SyncEmailIncidentKind } from '../../generated/prisma/enums';
import { syncIncidentEmailDue } from './sync-email-incident.policy';

const now = new Date('2026-09-23T20:00:00.000Z');

void test('geçici ilk senkronizasyon hatası e-posta üretmez', () => {
  assert.equal(
    syncIncidentEmailDue(
      SyncEmailIncidentKind.INVENTORY,
      1,
      new Date(now.getTime() - 5 * 60_000),
      now,
    ),
    false,
  );
});

void test('üç ardışık hata veya 15 dakika açık kalan sorun e-posta eşiğine ulaşır', () => {
  assert.equal(
    syncIncidentEmailDue(SyncEmailIncidentKind.QUESTION, 3, now, now),
    true,
  );
  assert.equal(
    syncIncidentEmailDue(
      SyncEmailIncidentKind.FULL,
      1,
      new Date(now.getTime() - 15 * 60_000),
      now,
    ),
    true,
  );
});

void test('kimlik doğrulama sorunu e-posta eşiğine anında ulaşır', () => {
  assert.equal(
    syncIncidentEmailDue(SyncEmailIncidentKind.AUTH, 1, now, now),
    true,
  );
});
