import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { RequestWithAuth } from '../../modules/auth/auth.types';
import { LoggingContext } from './logging-context';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    LoggingContext.update({
      userId: request.user?.id,
      workspaceId: readIdentifier(request, 'workspaceId'),
      storeId: readIdentifier(request, 'storeId'),
      route: readRoute(request),
    });

    return next.handle();
  }
}

function readIdentifier(request: Request, key: string) {
  const value = request.params?.[key] ?? request.query?.[key];
  return typeof value === 'string' && value.length <= 128 ? value : undefined;
}

function readRoute(request: Request) {
  const route = request.route as { path?: unknown } | undefined;
  if (typeof route?.path !== 'string') return undefined;
  return `${request.baseUrl}${route.path}`;
}
