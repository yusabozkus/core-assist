import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  configuredAdminEmails,
  isConfiguredAdminIdentity,
  normalizeEmailAddress,
} from './admin-access.policy';

@Injectable()
export class AdminAccessService {
  private readonly allowedEmails = configuredAdminEmails();

  isAdmin(user: Pick<AuthenticatedUser, 'email' | 'emailVerified'>) {
    return isConfiguredAdminIdentity(user, this.allowedEmails);
  }

  isAdminEmail(email: string) {
    return this.allowedEmails.has(normalizeEmailAddress(email));
  }

  getAllowedEmailAddresses() {
    return [...this.allowedEmails];
  }
}
