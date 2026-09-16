import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { assertAdminActionOrigin } from './admin-action-origin';

@Injectable()
export class AdminActionOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    assertAdminActionOrigin(request.headers.origin);
    return true;
  }
}
