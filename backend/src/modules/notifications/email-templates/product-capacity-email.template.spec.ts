import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  renderProductCapacityEmail,
  type ProductCapacityEmailEvent,
} from './product-capacity-email.template';

function render(event: ProductCapacityEmailEvent) {
  return renderProductCapacityEmail({
    recipientName: 'Ayşe',
    title: 'DeFacto: Ürün kapasitesi sınırına ulaşıldı',
    message: 'Yeni ürünler kapasite nedeniyle içe alınamıyor.',
    actionUrl: 'https://coreasistan.com/billing',
    preferencesUrl:
      'https://coreasistan.com/dashboard/settings/notifications?view=preferences',
    event,
  });
}

void test('product capacity email shows actual usage, plan and skipped products', () => {
  const result = render({
    planName: 'Starter',
    used: 5_000,
    limit: 5_000,
    skippedCount: 12,
  });

  assert.ok(result.html.includes('Ürün kapasitesine ulaşıldı'));
  assert.ok(result.html.includes('Starter planı'));
  assert.ok(result.html.includes('5.000 / 5.000'));
  assert.ok(result.html.includes('%100'));
  assert.ok(result.html.includes('width="100%" height="7"'));
  assert.ok(result.html.includes('12 ürün alınamadı'));
  assert.ok(result.html.includes('Güncellenmeye devam eder'));
  assert.ok(result.html.includes('Plan ve kullanımı incele'));
  assert.ok(result.html.includes('bildirim tercihlerinizi yönetin'));
});

void test('capacity email does not invent a skipped count and caps the visual bar', () => {
  const result = render({
    planName: 'Growth',
    used: 30_000,
    limit: 25_000,
    skippedCount: null,
  });

  assert.ok(result.html.includes('30.000 / 25.000'));
  assert.ok(result.html.includes('%120'));
  assert.ok(result.html.includes('width="100%" height="7"'));
  assert.ok(result.html.includes('Kapasite nedeniyle içe alınamıyor'));
  assert.ok(!result.html.includes('0 ürün alınamadı'));
});

void test('capacity email escapes untrusted plan labels', () => {
  const result = render({
    planName: '<script>Test & Plan</script>',
    used: 1,
    limit: 1,
    skippedCount: 1,
  });

  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(result.html.includes('Test &amp; Plan'));
  assert.ok(!result.html.includes('<script>'));
});
