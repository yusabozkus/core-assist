import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { createHttpLoggingMiddleware } from './http-logging.middleware';
import { LoggingContext } from './logging-context';
import { sanitizeLogValue, StructuredLogger } from './structured-logger';

for (const status of [200, 400, 401, 404, 500]) {
  void test(`invitation token is absent from HTTP ${status} completion and abort logs`, () => {
    for (const aborted of [false, true]) {
      for (const path of [
        '/api/workspace-invitations/secret-test-token/accept',
        '/api/workspace-invitations/secret-test-token',
        '/invite/secret-test-token',
        '/api/%77orkspace-invitations/secret-test-token%2Faccept',
      ]) {
        const records: unknown[] = [];
        const log = (record: unknown) => {
          records.push(record);
        };
        const request = {
          method: 'POST',
          path,
          header: () => undefined,
          get: () => undefined,
        } as unknown as Request;
        const response = Object.assign(new EventEmitter(), {
          statusCode: status,
          writableFinished: !aborted,
          setHeader: () => {},
        });
        createHttpLoggingMiddleware({ log, error: log, warn: log })(
          request,
          response as unknown as Response,
          () => {},
        );
        response.emit(aborted ? 'close' : 'finish');
        response.emit('close');
        assert.equal(records.length, 1);
        assert.doesNotMatch(JSON.stringify(records), /secret-test-token/);
        assert.match(JSON.stringify(records), /REDACTED/);
      }
    }
  });
}

void test('normal request paths and diagnostic fields remain useful', () => {
  const records: unknown[] = [];
  const request = {
    method: 'GET',
    path: '/api/stores/store-1/questions',
    header: () => undefined,
    get: () => undefined,
  } as unknown as Request;
  const response = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: true,
    setHeader: () => {},
  });
  createHttpLoggingMiddleware({
    log: (r: unknown) => records.push(r),
    error: () => {},
    warn: () => {},
  })(request, response as unknown as Response, () => {});
  response.emit('finish');
  assert.match(JSON.stringify(records), /\/api\/stores\/store-1\/questions/);
  assert.match(JSON.stringify(records), /durationMs/);
});

void test('JSON/pretty output redacts invitation paths in context, errors and nested data', (t) => {
  const previous = process.env.LOG_FORMAT;
  const lines: string[] = [];
  t.mock.method(process.stdout, 'write', (chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  });
  try {
    for (const format of ['json', 'pretty']) {
      process.env.LOG_FORMAT = format;
      const logger = new StructuredLogger();
      LoggingContext.run(
        { userAgent: 'https://example.test/invite/bearer-secret' },
        () => {
          logger.log({
            message: 'GET /api/workspace-invitations/bearer-secret/accept',
            nested: {
              url: 'https://example.test/invite/bearer-secret',
              error: new Error('/invite/bearer-secret'),
            },
          });
        },
      );
    }
  } finally {
    if (previous === undefined) delete process.env.LOG_FORMAT;
    else process.env.LOG_FORMAT = previous;
  }
  assert.equal(lines.length, 2);
  assert.doesNotMatch(lines.join(''), /bearer-secret/);
  assert.match(lines.join(''), /REDACTED/);
  assert.doesNotMatch(
    String(
      sanitizeLogValue('https%3A%2F%2Fexample.test%2Finvite%2Fbearer-secret'),
    ),
    /bearer-secret/,
  );
});
