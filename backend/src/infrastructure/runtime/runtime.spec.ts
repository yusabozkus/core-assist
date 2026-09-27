import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import { RuntimeState } from './runtime-state';
import { drainApplication } from './graceful-shutdown';
import { validateProductionConfig } from './production-config';
import { NotificationRetentionService } from '../../modules/notifications/notification-retention.service';

const staging = {
  NODE_ENV: 'production',
  DEPLOYMENT_ENV: 'staging',
  PADDLE_ENV: 'sandbox',
  CATALOG_CONNECTOR_MODE: 'live',
  QUESTION_CONNECTOR_MODE: 'live',
  DATABASE_URL: 'postgresql://local/test',
  REDIS_URL: 'redis://local',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  INTEGRATION_CREDENTIALS_KEY: 'x',
};

void test('production config rejects mock providers, test limits and accidental sandbox', () => {
  assert.doesNotThrow(() => validateProductionConfig(staging));
  for (const changes of [
    { CATALOG_CONNECTOR_MODE: 'mock' },
    { QUESTION_CONNECTOR_MODE: undefined },
    { BILLING_TEST_LIMITS_ENABLED: 'true' },
    { DEPLOYMENT_ENV: 'production' },
    { DEPLOYMENT_ENV: 'typo' },
    { PADDLE_ENV: 'typo' },
    { BETTER_AUTH_SECRET: 'short' },
    { DATABASE_URL: '' },
  ])
    assert.throws(() => validateProductionConfig({ ...staging, ...changes }));
});

void test('customer deployment requires service credentials without exposing their values', () => {
  const config = {
    ...staging,
    DEPLOYMENT_ENV: 'production',
    PADDLE_ENV: 'production',
  };
  assert.throws(() => validateProductionConfig(config), /GOOGLE_CLIENT_ID/);
  assert.doesNotThrow(() =>
    validateProductionConfig({ NODE_ENV: 'development' }),
  );
});

void test('shutdown closes SSE, waits for HTTP and active workers before provider destruction', async () => {
  const state = new RuntimeState();
  state.ready = true;
  let releaseHttp!: () => void;
  let releaseWorker!: () => void;
  const workerDone = new Promise<void>((resolve) => {
    releaseWorker = resolve;
  });
  let workerClosing = false,
    destroyed = false,
    timerStopped = false;
  class Host extends WorkerHost {
    process() {
      return Promise.resolve();
    }
  }
  const host = new Host();
  Object.defineProperty(host, 'worker', {
    value: {
      close: () => {
        workerClosing = true;
        return workerDone;
      },
    },
  });
  const server = createServer((request, response) => {
    if (request.url === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('data: connected\n\n');
      state.stopped.subscribe(() => response.end());
    } else releaseHttp = () => response.end('completed');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const events = await fetch(`${url}/events`);
  const eventBody = events.text();
  const request = fetch(`${url}/slow`).then((response) => response.text());
  while (!releaseHttp) await new Promise((resolve) => setTimeout(resolve, 5));
  const app = {
    get: (token: unknown) => {
      if (token === RuntimeState) return state;
      if (token === DiscoveryService)
        return { getProviders: () => [{ instance: host }] };
      if (token === NotificationRetentionService)
        return {
          stopAndDrain: () => {
            timerStopped = true;
            return Promise.resolve();
          },
        };
      throw new Error('Unexpected dependency');
    },
    getHttpServer: () => server,
    close: () => {
      destroyed = true;
      return Promise.resolve();
    },
  } as unknown as INestApplication;
  const closing = drainApplication(app);
  assert.equal(state.ready, false);
  assert.equal(state.draining, true);
  assert.equal(workerClosing, true);
  assert.equal(timerStopped, true);
  assert.equal(await eventBody, 'data: connected\n\n');
  assert.equal(destroyed, false);
  releaseHttp();
  assert.equal(await request, 'completed');
  assert.equal(destroyed, false);
  releaseWorker();
  await closing;
  assert.equal(destroyed, true);
});
