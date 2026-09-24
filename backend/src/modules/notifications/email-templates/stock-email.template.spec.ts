import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderStockEmail, type StockEmailEvent } from './stock-email.template';

const products = [
  {
    name: 'Pamuklu Tişört',
    variant: 'Siyah · M',
    stock: 2,
    imageUrl: 'https://cdn.dsmcdn.com/product-1.jpg',
  },
  {
    name: 'Chino Pantolon',
    variant: 'Lacivert · 32',
    stock: 1,
    imageUrl: null,
  },
  {
    name: 'Yazlık Gömlek',
    variant: 'Beyaz · L',
    stock: 4,
    imageUrl: 'https://productimages.hepsiburada.net/product-3.jpg',
  },
];

function render(event: StockEmailEvent) {
  return renderStockEmail({
    recipientName: 'Ayşe',
    title: 'DeFacto: 4 varyant kritik stokta',
    message: 'Stokları kontrol edin.',
    actionUrl:
      'https://coreasistan.com/dashboard/catalog/inventory?status=low_stock',
    preferencesUrl:
      'https://coreasistan.com/dashboard/settings/notifications?view=preferences',
    event,
  });
}

void test('low-stock digest shows three real variants, images and remaining count', () => {
  const result = render({
    kind: 'LOW_STOCK',
    currentCount: 18,
    newCount: 4,
    products,
  });

  assert.ok(result.html.includes('Kritik stok'));
  assert.ok(result.html.includes('Pamuklu Tişört'));
  assert.ok(result.html.includes('Siyah · M'));
  assert.ok(result.html.includes('2 adet'));
  assert.ok(result.html.includes('https://cdn.dsmcdn.com/product-1.jpg'));
  assert.ok(result.html.includes('+1 varyant daha'));
  assert.ok(result.html.includes('bildirim tercihlerinizi yönetin'));
});

void test('out-of-stock digest shows depleted state', () => {
  const result = render({
    kind: 'OUT_OF_STOCK',
    currentCount: 5,
    newCount: 1,
    products: [{ ...products[0], stock: 0 }],
  });

  assert.ok(result.html.includes('Tükenen stok'));
  assert.ok(result.html.includes('Tükendi'));
  assert.ok(result.html.includes('Toplam tükenen'));
  assert.ok(!result.html.includes('+1 varyant daha'));
});

void test('stock email escapes product data and excludes unsafe images', () => {
  const result = render({
    kind: 'LOW_STOCK',
    currentCount: 1,
    newCount: 1,
    products: [
      {
        name: '<script>alert(1)</script>',
        variant: 'M & L',
        stock: 1,
        imageUrl: 'javascript:alert(1)',
      },
    ],
  });

  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(result.html.includes('M &amp; L'));
  assert.ok(!result.html.includes('<script>'));
  assert.ok(!result.html.includes('javascript:alert'));
});
