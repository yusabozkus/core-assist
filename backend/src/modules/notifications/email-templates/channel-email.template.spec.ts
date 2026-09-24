import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  SyncEmailDeliveryPhase,
  SyncEmailIncidentKind,
} from '../../../generated/prisma/enums';
import {
  renderChannelEmail,
  type ChannelEmailEvent,
} from './channel-email.template';

function render(event: ChannelEmailEvent) {
  return renderChannelEmail({
    recipientName: 'Ayşe',
    title: 'DeFacto · Trendyol: Kanal sorunu',
    message: 'Kanal işlemlerini kontrol edin.',
    actionUrl: `https://coreasistan.com/dashboard/channels${event.kind === SyncEmailIncidentKind.AUTH ? '' : '/sync'}`,
    preferencesUrl:
      'https://coreasistan.com/dashboard/settings/notifications?view=preferences',
    event,
  });
}

void test('channel connection failure and recovery show the provider and affected operations', () => {
  const event = {
    providerKey: 'trendyol',
    storeName: 'DeFacto',
    kind: SyncEmailIncidentKind.AUTH,
    phase: SyncEmailDeliveryPhase.OPEN,
  };
  const failed = render(event);

  assert.ok(failed.html.includes('Kanal bağlantısı kesildi'));
  assert.ok(failed.html.includes('Trendyol'));
  assert.ok(
    failed.html.includes('https://coreasistan.com/merchants/trendyol.webp'),
  );
  assert.ok(failed.html.includes('DeFacto mağazası'));
  assert.ok(failed.html.includes('Cevap gönderimi'));
  assert.ok(failed.html.includes('Kanal bağlantısını görüntüle'));
  assert.ok(failed.html.includes('bildirim tercihlerinizi yönetin'));

  const recovered = render({
    ...event,
    phase: SyncEmailDeliveryPhase.RESOLVED,
  });
  assert.ok(recovered.html.includes('Kanal bağlantısı yeniden sağlandı'));
  assert.ok(recovered.html.includes('Bağlantı yeniden doğrulandı'));
  assert.ok(!recovered.html.includes('Etkilenebilecek işlemler'));
});

void test('product, inventory and question sync emails describe their own impact', () => {
  const cases = [
    [SyncEmailIncidentKind.FULL, 'Ürün senkronizasyonu', 'yeni ürün'],
    [SyncEmailIncidentKind.INVENTORY, 'Stok senkronizasyonu', 'Stok bilgileri'],
    [
      SyncEmailIncidentKind.QUESTION,
      'Soru senkronizasyonu',
      'müşteri soruları',
    ],
  ] as const;

  for (const [kind, operation, impact] of cases) {
    const event = {
      providerKey: 'hepsiburada',
      storeName: 'Test',
      kind,
      phase: SyncEmailDeliveryPhase.OPEN,
    };
    const failed = render(event);
    assert.ok(failed.html.includes(operation));
    assert.ok(failed.html.includes(impact));
    assert.ok(failed.html.includes('Sorun var'));
    assert.ok(failed.html.includes('merchants/hepsiburada.webp'));
    assert.ok(failed.html.includes('Senkronizasyon geçmişini aç'));

    const recovered = render({
      ...event,
      phase: SyncEmailDeliveryPhase.RESOLVED,
    });
    assert.ok(recovered.html.includes('yeniden çalışıyor'));
    assert.ok(recovered.html.includes('Tamamlandı'));
    assert.ok(!recovered.html.includes(impact));
  }
});

void test('unknown providers and untrusted store names cannot inject email HTML', () => {
  const result = render({
    providerKey: '<script>alert(1)</script>',
    storeName: 'Mağaza & <img src=x>',
    kind: SyncEmailIncidentKind.QUESTION,
    phase: SyncEmailDeliveryPhase.OPEN,
  });

  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(result.html.includes('Mağaza &amp; &lt;img src=x&gt;'));
  assert.ok(!result.html.includes('<script>'));
  assert.ok(!result.html.includes('<img src=x>'));
  assert.ok(!result.html.includes('merchants/<script>'));
});
