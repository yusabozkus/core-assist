import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  renderBillingEmail,
  type BillingEmailEvent,
} from './billing-email.template';

const cases: Array<{
  event: BillingEmailEvent;
  expected: string;
  action: string;
}> = [
  {
    event: {
      kind: 'PAYMENT_FAILED',
      plan: 'Growth',
      updatedAt: new Date('2026-09-24T12:00:00.000Z'),
    },
    expected: 'Ödeme bekleniyor',
    action: 'Ödemeyi yönet',
  },
  {
    event: {
      kind: 'SUBSCRIPTION_ACTIVATED',
      plan: 'Growth',
      cycle: 'Aylık',
      nextBilledAt: new Date('2026-10-24T12:00:00.000Z'),
    },
    expected: '24 Ekim 2026',
    action: 'Faturaları görüntüle',
  },
  {
    event: {
      kind: 'PLAN_CHANGED',
      previousPlan: 'Starter',
      plan: 'Growth',
      cycle: 'Aylık',
      nextBilledAt: null,
    },
    expected: 'Starter → Growth',
    action: 'Planımı görüntüle',
  },
  {
    event: {
      kind: 'CANCELLATION_SCHEDULED',
      plan: 'Growth',
      accessEndsAt: new Date('2026-10-24T12:00:00.000Z'),
    },
    expected: '24 Ekim 2026',
    action: 'Aboneliğimi görüntüle',
  },
  {
    event: {
      kind: 'SUBSCRIPTION_ENDED',
      plan: 'Growth',
      endedAt: new Date('2026-10-24T12:00:00.000Z'),
    },
    expected: 'Kayıtlar ve manuel yanıtlar',
    action: 'Planları incele',
  },
  {
    event: { kind: 'REFUND_APPROVED', amount: '2.300,00 ₺' },
    expected: '2.300,00 ₺',
    action: 'Faturaları görüntüle',
  },
];

for (const { event, expected, action } of cases) {
  void test(`${event.kind} uses the billing template`, () => {
    const rendered = renderBillingEmail({
      recipientName: 'Ayşe',
      title: 'Ödeme bildirimi',
      message: 'Ödeme durumunuz güncellendi.',
      actionUrl: 'https://coreasistan.com/billing/test',
      event,
    });

    assert.equal(rendered.subject, 'Ödeme bildirimi');
    assert.match(rendered.html, /https:\/\/coreasistan.com\/logo\/text.png/);
    assert.ok(rendered.html.includes(expected));
    assert.ok(rendered.html.includes(action));
    assert.ok(rendered.html.includes('https://coreasistan.com/billing/test'));
    assert.ok(!rendered.html.includes('Fatura numarası'));
  });
}

void test('billing details are escaped before rendering', () => {
  const rendered = renderBillingEmail({
    recipientName: 'Ayşe',
    title: 'İade',
    message: 'İade onaylandı.',
    actionUrl: 'https://coreasistan.com/billing/test',
    event: { kind: 'REFUND_APPROVED', amount: '<script>alert(1)</script>' },
  });

  assert.ok(rendered.html.includes('&lt;script&gt;'));
  assert.ok(!rendered.html.includes('<script>'));
});
