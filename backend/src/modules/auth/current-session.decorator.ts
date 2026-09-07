import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedSession, RequestWithAuth } from './auth.types';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedSession => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const session = request.session;

    if (!session) {
      throw new UnauthorizedException('Oturum açmanız gerekmektedir.');
    }

    return session;
  },
);
