import { createHmac, timingSafeEqual } from 'node:crypto';
import { EmailProviderStatus } from '../../generated/prisma/enums';

export const RESEND_EVENT_STATUSES: Readonly<
  Record<string, EmailProviderStatus>
> = {
  'email.sent': EmailProviderStatus.SENT,
  'email.delivery_delayed': EmailProviderStatus.DELAYED,
  'email.delivered': EmailProviderStatus.DELIVERED,
  'email.failed': EmailProviderStatus.FAILED,
  'email.suppressed': EmailProviderStatus.SUPPRESSED,
  'email.bounced': EmailProviderStatus.BOUNCED,
  'email.complained': EmailProviderStatus.COMPLAINED,
};

// Terminal failures and complaints take precedence over delayed or late sent events.
const STATUS_ORDER: readonly EmailProviderStatus[] = [
  'UNKNOWN',
  'SENT',
  'DELAYED',
  'DELIVERED',
  'FAILED',
  'SUPPRESSED',
  'BOUNCED',
  'COMPLAINED',
];

export function precedingEmailStatuses(status: EmailProviderStatus) {
  return STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(status));
}

export function verifyResendSignature(
  rawBody: Buffer,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string,
  now = Date.now(),
) {
  const { id, timestamp, signature } = headers;
  if (
    !id ||
    id.length > 255 ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !signature ||
    signature.length > 4096
  )
    return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300)
    return false;
  const encodedSecret = secret.replace(/^whsec_/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSecret)) return false;
  const key = Buffer.from(encodedSecret, 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.`)
    .update(rawBody)
    .digest();
  return signature.split(/\s+/).some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
      return false;
    const actual = Buffer.from(value, 'base64');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
}

export function parseResendEvent(payload: unknown) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid event');
  const event = payload as Record<string, unknown>;
  if (typeof event.type !== 'string') throw new Error('Invalid event type');
  const status = Object.hasOwn(RESEND_EVENT_STATUSES, event.type)
    ? RESEND_EVENT_STATUSES[event.type]
    : undefined;
  if (!status) return null;
  const data = event.data as Record<string, unknown> | undefined;
  if (
    !data ||
    typeof data.email_id !== 'string' ||
    !data.email_id ||
    data.email_id.length > 100 ||
    typeof event.created_at !== 'string'
  )
    throw new Error('Invalid event data');
  const occurredAt = new Date(event.created_at);
  if (!Number.isFinite(occurredAt.getTime()))
    throw new Error('Invalid event date');
  return {
    type: event.type,
    status,
    providerMessageId: data.email_id,
    occurredAt,
  };
}
