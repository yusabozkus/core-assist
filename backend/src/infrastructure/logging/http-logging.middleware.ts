import { randomUUID } from 'node:crypto';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithAuth } from '../../modules/auth/auth.types';
import { LoggingContext } from './logging-context';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function createHttpLoggingMiddleware(logger: LoggerService) {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestId = resolveRequestId(request.header('x-request-id'));
    const startedAt = process.hrtime.bigint();
    let completed = false;

    response.setHeader('X-Request-ID', requestId);

    LoggingContext.run(
      {
        requestId,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      },
      () => {
        const writeCompletionLog = (aborted: boolean) => {
          if (completed) return;
          completed = true;

          const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
          const authenticatedRequest = request as RequestWithAuth;
          const context = LoggingContext.get();
          const record = {
            message: aborted
              ? 'HTTP request aborted.'
              : 'HTTP request completed.',
            event: 'http_request',
            method: request.method,
            path: request.path,
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ...(authenticatedRequest.user?.id
              ? { userId: authenticatedRequest.user.id }
              : {}),
            ...(context?.workspaceId
              ? { workspaceId: context.workspaceId }
              : {}),
            ...(context?.storeId ? { storeId: context.storeId } : {}),
            ...(context?.route ? { route: context.route } : {}),
            ...(aborted ? { aborted: true } : {}),
          };

          if (aborted || response.statusCode >= 500) {
            logger.error(record, 'Http');
          } else if (response.statusCode >= 400) {
            logger.warn(record, 'Http');
          } else {
            logger.log(record, 'Http');
          }
        };

        response.once('finish', () => writeCompletionLog(false));
        response.once('close', () => {
          if (!response.writableFinished) writeCompletionLog(true);
        });
        next();
      },
    );
  };
}

function resolveRequestId(headerValue: string | undefined) {
  const candidate = headerValue?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}
