import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestWithAuth } from '../auth/auth.types';
import { AdminAccessService } from './admin-access.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminAccess: AdminAccessService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Oturum açmanız gerekmektedir.');
    }

    if (!this.adminAccess.isAdmin(user)) {
      throw new ForbiddenException('Bu alana erişim yetkiniz bulunmuyor.');
    }

    return true;
  }
}
