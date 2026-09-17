import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from './auth.service';
import type { RequestWithAuth } from './auth.types';
import { LoggingContext } from '../../infrastructure/logging/logging-context';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException('Oturum açmanız gerekmektedir.');
    }

    request.user = session.user;
    request.session = session.session;
    LoggingContext.update({ userId: session.user.id });
    return true;
  }
}
