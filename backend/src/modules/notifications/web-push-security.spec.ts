import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import dns, { type LookupAddress } from 'node:dns';
import https, { type RequestOptions } from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import {
  isPublicPushAddress,
  validatePushEndpoint,
  validatePushSubscription,
  publicPushLookup,
  sendSafeWebPush,
  PUSH_DEADLINE_MS,
  PushDeliveryError,
} from './web-push-security';

function subscription() {
  const key = createECDH('prime256v1');
  key.generateKeys();
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
    keys: {
      p256dh: key.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
}

void test('supported browser push domains and real P256 key material are accepted', () => {
  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/test',
    'https://updates.push.services.mozilla.com/wpush/v2/test',
    'https://web.push.apple.com/test',
    'https://wns2-am3p.notify.windows.com/w/?token=test',
    'https://db3.notify.windows.com/?token=test',
  ])
    assert.equal(
      validatePushSubscription({ ...subscription(), endpoint }).hostname,
      new URL(endpoint).hostname,
    );
});

void test('private IPs, lookalikes, alternate ports, credentials and unsupported origins are rejected', () => {
  for (const endpoint of [
    'https://127.0.0.1/x',
    'https://10.0.0.1/x',
    'https://[::1]/x',
    'https://169.254.169.254/x',
    'https://[::ffff:127.0.0.1]/x',
    'https://attacker.example/x',
    'https://fcm.googleapis.com.attacker.example/x',
    'https://evilnotify.windows.com/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'http://fcm.googleapis.com/x',
    'https://fcm.googleapis.com/x#fragment',
    'https://fcm.googleapis.com./x',
  ])
    assert.throws(() => validatePushEndpoint(endpoint), Error, endpoint);
});

void test('malformed base64, incorrect sizes and off-curve public keys are rejected', () => {
  const valid = subscription();
  for (const p256dh of [
    '',
    'garbage',
    Buffer.alloc(65, 4).toString('base64url'),
    valid.keys.p256dh + '!',
  ]) {
    assert.throws(() =>
      validatePushSubscription({ ...valid, keys: { ...valid.keys, p256dh } }),
    );
  }
  for (const auth of [
    '',
    'a'.repeat(16),
    randomBytes(17).toString('base64url'),
  ]) {
    assert.throws(() =>
      validatePushSubscription({ ...valid, keys: { ...valid.keys, auth } }),
    );
  }
});

void test('only public unicast addresses can be used by the push socket', () => {
  for (const ip of [
    '127.0.0.1',
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '198.19.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '192.0.2.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2002:7f00:1::',
    '64:ff9b::7f00:1',
    'not-an-ip',
  ]) {
    assert.equal(isPublicPushAddress(ip), false, ip);
  }
  for (const ip of [
    '8.8.8.8',
    '1.1.1.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ]) {
    assert.equal(isPublicPushAddress(ip), true, ip);
  }
});

void test('socket resolver rejects mixed public/private DNS answers and returns validated addresses directly', async (t) => {
  let addresses: LookupAddress[] = [
    { address: '8.8.8.8', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ];
  let calls = 0;
  t.mock.method(
    dns,
    'lookup',
    (
      _host: string,
      _opts: unknown,
      callback: (error: Error | null, records: LookupAddress[]) => void,
    ) => {
      calls++;
      callback(null, addresses);
    },
  );
  const resolve = () =>
    new Promise<unknown>((accept, reject) => {
      publicPushLookup('fcm.googleapis.com', { all: true }, (error, result) =>
        error ? reject(error) : accept(result),
      );
    });
  await assert.rejects(resolve(), /not public/);
  addresses = [{ address: '8.8.8.8', family: 4 }];
  assert.deepEqual(await resolve(), addresses);
  assert.equal(calls, 2);
});

void test('transport never follows redirects and retains gone status for cleanup', async (t) => {
  let statusCode = 302;
  let requests = 0;
  t.mock.method(
    https,
    'request',
    (
      _url: URL,
      options: RequestOptions,
      onResponse: (response: PassThrough & { statusCode: number }) => void,
    ) => {
      requests++;
      assert.equal(options.lookup, publicPushLookup);
      assert.equal(options.agent, false);
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error: Error) => void;
      };
      req.destroy = (error) => {
        req.emit('error', error);
        req.emit('close');
      };
      req.end = () => {
        onResponse(Object.assign(new PassThrough(), { statusCode }));
        req.emit('close');
      };
      return req;
    },
  );
  await assert.rejects(
    sendSafeWebPush(subscription(), 'test'),
    (error) => error instanceof PushDeliveryError && error.statusCode === 302,
  );
  statusCode = 410;
  await assert.rejects(
    sendSafeWebPush(subscription(), 'test'),
    (error) => error instanceof PushDeliveryError && error.statusCode === 410,
  );
  assert.equal(requests, 2);
});

void test('total deadline destroys an unresponsive request; later requests can succeed', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let stalled = true;
  let destroyed = false;
  t.mock.method(
    https,
    'request',
    (
      _url: URL,
      _options: RequestOptions,
      onResponse: (response: PassThrough & { statusCode: number }) => void,
    ) => {
      const req = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error: Error) => void;
      };
      req.destroy = (error) => {
        destroyed = true;
        req.emit('error', error);
        req.emit('close');
      };
      req.end = () => {
        if (stalled) return;
        const response = Object.assign(new PassThrough(), { statusCode: 201 });
        onResponse(response);
        response.end();
        req.emit('close');
      };
      return req;
    },
  );
  const pending = assert.rejects(
    sendSafeWebPush(subscription(), 'test'),
    /timed out/,
  );
  t.mock.timers.tick(PUSH_DEADLINE_MS + 1);
  await pending;
  assert.equal(destroyed, true);
  stalled = false;
  await sendSafeWebPush(subscription(), 'test');
});
