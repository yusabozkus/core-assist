import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderAiEmail, type AiEmailEvent } from './ai-email.template';

const examples: Array<{
  event: AiEmailEvent;
  expected: string;
  action: string;
}> = [
  {
    event: { kind: 'REVIEW_DIGEST', pendingCount: 10, newCount: 8 },
    expected: 'İnceleme bekleyen',
    action: 'Soruları incele',
  },
  {
    event: { kind: 'USAGE', used: 1200, limit: 1500, remaining: 300 },
    expected: '1.200 / 1.500',
    action: 'Kullanımı görüntüle',
  },
  {
    event: { kind: 'USAGE', used: 1500, limit: 1500, remaining: 0 },
    expected: 'Soru hakkınızın tamamı kullanıldı',
    action: 'Plan seçeneklerini incele',
  },
  {
    event: {
      kind: 'OPERATION_FAILURE',
      process: 'draft',
      phase: 'summary',
      affectedCount: 4,
    },
    expected: 'Son bildirimden beri etkilenen soru',
    action: 'Soruları kontrol et',
  },
  {
    event: { kind: 'OPERATION_RECOVERED', process: 'answer' },
    expected: 'Cevap gönderimi yeniden çalışıyor',
    action: 'Gelen kutusuna git',
  },
  {
    event: { kind: 'AUTOMATION_PAUSED', reason: 'quota' },
    expected: 'AI soru hakkı doldu',
    action: 'Plan ve kullanımı incele',
  },
  {
    event: { kind: 'AUTOMATION_PAUSED', reason: 'subscription' },
    expected: 'Abonelik erişimi aktif değil',
    action: 'Ödeme durumunu incele',
  },
];

for (const { event, expected, action } of examples) {
  void test(`${event.kind} uses the AI email template`, () => {
    const result = renderAiEmail({
      recipientName: 'Ayşe',
      title: 'Bilgilendirme',
      message: 'Durumu kontrol edin.',
      actionUrl: 'https://coreasistan.com/dashboard/inbox',
      preferencesUrl:
        'https://coreasistan.com/dashboard/settings/notifications?view=preferences',
      event,
    });

    assert.equal(result.subject, 'Bilgilendirme');
    assert.ok(result.html.includes(expected));
    assert.ok(result.html.includes(action));
    assert.ok(result.html.includes('https://coreasistan.com/logo/text.png'));
    assert.ok(result.html.includes('bildirim tercihlerinizi yönetin'));
    assert.ok(result.html.includes('https://coreasistan.com/dashboard/inbox'));
  });
}

void test('AI email escapes user-provided text and URLs', () => {
  const result = renderAiEmail({
    recipientName: '<script>',
    title: '<b>Uyarı</b>',
    message: '<img src=x>',
    actionUrl: 'https://coreasistan.com/?q="unsafe"',
    preferencesUrl: 'https://coreasistan.com/?x="unsafe"',
    event: { kind: 'REVIEW_DIGEST', pendingCount: 1, newCount: 1 },
  });

  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(result.html.includes('&lt;img src=x&gt;'));
  assert.ok(result.html.includes('&quot;unsafe&quot;'));
  assert.ok(!result.html.includes('<script>'));
});
