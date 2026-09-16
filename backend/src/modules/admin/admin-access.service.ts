import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class AdminAccessService {
  private readonly allowedEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  isAdmin(user: Pick<AuthenticatedUser, 'email' | 'emailVerified'>) {
    return (
      user.emailVerified &&
      this.allowedEmails.has(normalizeEmailAddress(user.email))
    );
  }

  isAdminEmail(email: string) {
    return this.allowedEmails.has(normalizeEmailAddress(email));
  }

  getAllowedEmailAddresses() {
    return [...this.allowedEmails];
  }
}

function parseAdminEmails(value: string | undefined) {
  return new Set(
    (value ?? '').split(',').map(normalizeEmailAddress).filter(Boolean),
  );
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}
