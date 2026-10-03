import { BadRequestException } from '@nestjs/common';
import { ECDH } from 'node:crypto';
import { lookup } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { request, type RequestOptions } from 'node:https';
import webPush from 'web-push';

export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;
export const PUSH_DEADLINE_MS = 10_000;

export function validatePushSubscription(
  subscription: webPush.PushSubscription,
) {
  const endpoint = validatePushEndpoint(subscription.endpoint);
  const publicKey = decodeKey(subscription.keys.p256dh, 65);
  decodeKey(subscription.keys.auth, 16);
  try {
    if (publicKey[0] !== 4) throw new Error('Not an uncompressed EC point');
    ECDH.convertKey(publicKey, 'prime256v1');
  } catch {
    throw new BadRequestException('Tarayıcı bildirim anahtarı geçersiz.');
  }
  return endpoint;
}

export function validatePushEndpoint(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Tarayıcı bildirim adresi geçersiz.');
  }
  const allowed =
    url.hostname === 'fcm.googleapis.com' ||
    url.hostname === 'updates.push.services.mozilla.com' ||
    /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname) ||
    /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    value.length > 2048 ||
    /[\s\\]/.test(value) ||
    (url.pathname === '/' && !url.search)
  ) {
    throw new BadRequestException(
      'Bu tarayıcı bildirim servisi desteklenmiyor.',
    );
  }
  return url;
}

function decodeKey(value: string, bytes: number) {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) {
    throw new BadRequestException('Tarayıcı bildirim anahtarı geçersiz.');
  }
  const buffer = Buffer.from(value, 'base64url');
  if (
    buffer.length !== bytes ||
    buffer.toString('base64url') !== value.replace(/=+$/, '')
  ) {
    throw new BadRequestException('Tarayıcı bildirim anahtarı geçersiz.');
  }
  return buffer;
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

export function isPublicPushAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return (
    family === 6 &&
    globalV6.check(address, 'ipv6') &&
    !blocked.check(address, 'ipv6')
  );
}

// This is the socket's resolver, not a separate preflight DNS check. The
// validated addresses are handed directly to TLS; there is no second lookup.
export const publicPushLookup: NonNullable<RequestOptions['lookup']> = (
  hostname,
  options,
  callback,
) => {
  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error, [], 0);
      return;
    }
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicPushAddress(address))
    ) {
      callback(new Error('Push DNS target is not public.'), [], 0);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

export class PushDeliveryError extends Error {
  constructor(readonly statusCode: number) {
    super(`Push service returned HTTP ${statusCode}.`);
  }
}

export async function sendSafeWebPush(
  subscription: webPush.PushSubscription,
  payload: string,
) {
  const endpoint = validatePushSubscription(subscription);
  const details = webPush.generateRequestDetails(subscription, payload, {
    TTL: 300,
  });
  // Retain web-push encryption/VAPID. Native HTTPS does not follow redirects or
  // environment proxies; a total deadline also covers DNS/TLS/slow responses.
  await new Promise<void>((resolve, reject) => {
    const req = request(
      endpoint,
      {
        method: details.method,
        headers: details.headers,
        agent: false,
        lookup: publicPushLookup,
        timeout: PUSH_DEADLINE_MS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        response.on('error', reject);
        response.on('aborted', () =>
          reject(new Error('Push response aborted.')),
        );
        if (status < 200 || status > 299) {
          response.destroy();
          reject(new PushDeliveryError(status));
          return;
        }
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 64 * 1024)
            req.destroy(new Error('Push response exceeded limit.'));
        });
        response.on('end', resolve);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error('Push delivery timed out.')),
      PUSH_DEADLINE_MS,
    );
    req.once('close', () => clearTimeout(deadline));
    req.once('timeout', () => req.destroy(new Error('Push socket timed out.')));
    req.once('error', reject);
    req.end(details.body);
  });
}
