import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import {
  parseResendEvent,
  precedingEmailStatuses,
  verifyResendSignature,
} from './resend-webhook.policy';

const secret = 'whsec_plJ3nmyCDGBKInavdOK15jsl';
const timestamp = '1731705121';
const body = Buffer.from('{"event_type":"ping","data":{"success":true}}');
const headers = {
  id: 'msg_loFOjxBNrRLzqYUf',
  timestamp,
  signature: 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
};
const now = Number(timestamp) * 1000;

void test('accepts the published Svix signature vector using the original bytes', () => {
  assert.equal(verifyResendSignature(body, headers, secret, now), true);
  assert.equal(
    verifyResendSignature(
      Buffer.from(body.toString() + ' '),
      headers,
      secret,
      now,
    ),
    false,
  );
  assert.equal(
    verifyResendSignature(body, { ...headers, id: 'other' }, secret, now),
    false,
  );
});

void test('rejects expired, future, malformed and missing signature headers', () => {
  assert.equal(
    verifyResendSignature(body, headers, secret, now + 301000),
    false,
  );
  assert.equal(
    verifyResendSignature(body, headers, secret, now - 301000),
    false,
  );
  assert.equal(
    verifyResendSignature(body, { ...headers, timestamp: 'NaN' }, secret, now),
    false,
  );
  assert.equal(
    verifyResendSignature(body, { ...headers, signature: 'v1,a' }, secret, now),
    false,
  );
  assert.equal(verifyResendSignature(body, {}, secret, now), false);
  assert.equal(
    verifyResendSignature(body, headers, 'not-a-secret', now),
    false,
  );
});

void test('supports multiple signatures during signing key rotation', () => {
  assert.equal(
    verifyResendSignature(
      body,
      { ...headers, signature: `v2,ignored v1,AAAA ${headers.signature}` },
      secret,
      now,
    ),
    true,
  );
});

void test('verifies UTF-8 bytes and rejects a signature made with a different key', () => {
  const payload = Buffer.from('{"subject":"Ödeme bildirimi — İpek"}');
  const signature = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
    .update(`${headers.id}.${timestamp}.`)
    .update(payload)
    .digest('base64');
  assert.equal(
    verifyResendSignature(
      payload,
      { ...headers, signature: `v1,${signature}` },
      secret,
      now,
    ),
    true,
  );
  assert.equal(
    verifyResendSignature(
      payload,
      { ...headers, signature: `v1,${signature}` },
      'whsec_b3RoZXI=',
      now,
    ),
    false,
  );
});

void test('ignores unsupported events and rejects malformed supported payloads', () => {
  assert.equal(parseResendEvent({ type: 'email.opened' }), null);
  assert.equal(parseResendEvent({ type: 'toString' }), null);
  assert.throws(() => parseResendEvent({ type: 'email.delivered', data: {} }));
  assert.throws(() =>
    parseResendEvent({
      type: 'email.delivered',
      created_at: 'invalid',
      data: { email_id: 'id' },
    }),
  );
  const parsed = parseResendEvent({
    type: 'email.bounced',
    created_at: '2026-09-25T12:00:00Z',
    data: {
      email_id: 'id',
      to: ['private@example.com'],
      subject: 'private',
      bounce: { message: 'private' },
    },
  });
  assert.equal(parsed?.status, 'BOUNCED');
  assert.deepEqual(Object.keys(parsed).sort(), [
    'occurredAt',
    'providerMessageId',
    'status',
    'type',
  ]);
});

void test('late sent and delayed events cannot overwrite delivered or terminal failures', () => {
  assert.ok(precedingEmailStatuses('DELIVERED').includes('DELAYED'));
  assert.ok(!precedingEmailStatuses('DELAYED').includes('DELIVERED'));
  assert.ok(!precedingEmailStatuses('SENT').includes('BOUNCED'));
  assert.ok(precedingEmailStatuses('COMPLAINED').includes('BOUNCED'));
  assert.ok(!precedingEmailStatuses('BOUNCED').includes('COMPLAINED'));
});
