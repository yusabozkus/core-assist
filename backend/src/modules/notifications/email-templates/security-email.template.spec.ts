import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderSecurityEmail } from './security-email.template';

void test('linked provider email includes the provider and account action', () => {
  const result = renderSecurityEmail({
    recipientName: 'Ayşe',
    actionUrl: 'https://coreasistan.com/dashboard/settings/profile',
    event: { kind: 'PROVIDER_LINKED', provider: 'Google' },
  });

  assert.equal(result.subject, 'Yeni giriş yöntemi bağlandı');
  assert.match(result.html, /Google hesabı Core Asistan profilinize bağlandı/);
  assert.match(result.html, /https:\/\/coreasistan.com\/logo\/text.png/);
  assert.match(result.html, /dashboard\/settings\/profile/);
  assert.doesNotMatch(result.html, /bildirim tercihleri/i);
});

void test('removed provider email escapes dynamic values', () => {
  const result = renderSecurityEmail({
    recipientName: '<Ayşe>',
    actionUrl: 'https://coreasistan.com/admin/account',
    event: { kind: 'PROVIDER_REMOVED', provider: '<Microsoft>' },
  });

  assert.equal(result.subject, 'Giriş yöntemi kaldırıldı');
  assert.match(result.html, /&lt;Ayşe&gt;/);
  assert.match(result.html, /&lt;Microsoft&gt;/);
  assert.doesNotMatch(result.html, /<Microsoft>/);
  assert.match(result.html, /https:\/\/coreasistan.com\/admin\/account/);
});

void test('revoked sessions email has no provider-specific content', () => {
  const result = renderSecurityEmail({
    recipientName: 'Yuşa',
    actionUrl: 'https://coreasistan.com/admin/account',
    event: { kind: 'OTHER_SESSIONS_REVOKED' },
  });

  assert.equal(result.subject, 'Diğer oturumlar sonlandırıldı');
  assert.match(result.html, /Diğer cihazlardaki oturumlar/);
  assert.doesNotMatch(result.html, /Google|Microsoft/);
});
