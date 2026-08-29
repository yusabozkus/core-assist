import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser, RequestWithAuth } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Oturum açmanız gerekmektedir.');
    }

    return user;
  },
);
