import { Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { lastLoginMethod } from 'better-auth/plugins';
import { PrismaService } from '../../database/prisma.service';
import {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

function environmentURL(name: string, developmentFallback: string): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} environment variable is required in production.`);
  }

  return developmentFallback;
}

function createAppAuth(
  prisma: PrismaService,
  notifications: NotificationsService,
) {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseURL = environmentURL('BETTER_AUTH_URL', 'http://localhost:4001');
  const frontendURL = environmentURL('FRONTEND_URL', 'http://localhost:3001');
  const trustedOrigins = new Set([frontendURL]);
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

  if (Boolean(microsoftClientId) !== Boolean(microsoftClientSecret)) {
    throw new Error(
      'MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured together.',
    );
  }

  if (!isProduction) {
    trustedOrigins.add('http://localhost:3001');
  }

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secret: requiredEnvironmentVariable('BETTER_AUTH_SECRET'),
    baseURL,
    basePath: '/api/auth',
    plugins: [
      lastLoginMethod({
        cookieName: 'core-assist.last-login-method',
        maxAge: 60 * 60 * 24 * 180,
        storeInDatabase: false,
        // Remember only a completed sign-in, never a provider button click.
        beforeStoreCookie: (context, method) =>
          Boolean(context.context.newSession) &&
          (method === 'google' || method === 'microsoft'),
      }),
    ],
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        // An email match alone must not merge Google and Microsoft identities.
        disableImplicitLinking: true,
      },
    },
    user: {
      deleteUser: {
        // Deletion must use the authenticated, billing-aware Users endpoint.
        // Leaving this route enabled would bypass its atomic closure checks.
        enabled: false,
      },
    },
    session: {
      // Microsoft avatars are inline images; keep them out of cookie headers.
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      user: {
        update: {
          before: (user, context) => {
            if (
              context?.path.startsWith('/callback/') &&
              context.params?.id === 'microsoft' &&
              'image' in user
            ) {
              // Refresh the avatar without overwriting the locally edited name
              // or changing the existing account's email/verification state.
              return Promise.resolve({
                data: {
                  ...user,
                  name: undefined,
                  email: undefined,
                  emailVerified: undefined,
                },
              });
            }

            return Promise.resolve();
          },
        },
      },
      account: {
        create: {
          after: async (account) => {
            const accountCount = await prisma.account.count({
              where: { userId: account.userId },
            });
            if (accountCount < 2) return;

            await notifications.createForUser({
              recipientUserId: account.userId,
              type: NotificationType.SECURITY_ACCOUNT_CHANGED,
              severity: NotificationSeverity.INFO,
              title: 'Yeni giriş yöntemi bağlandı',
              message: `${authProviderLabel(account.providerId)} hesabı CoreAssist profilinize bağlandı. Bu işlemi siz yapmadıysanız bağlı hesaplarınızı kontrol edin.`,
              actionUrl: '/dashboard/settings/profile',
              entityType: 'AUTH_ACCOUNT',
              entityId: account.id,
              dedupeKey: `security-account-linked:${account.id}`,
            });
          },
        },
        delete: {
          after: async (account) => {
            await notifications.createForUser({
              recipientUserId: account.userId,
              type: NotificationType.SECURITY_ACCOUNT_CHANGED,
              severity: NotificationSeverity.WARNING,
              title: 'Giriş yöntemi kaldırıldı',
              message: `${authProviderLabel(account.providerId)} hesabı CoreAssist profilinizden kaldırıldı. Bu işlemi siz yapmadıysanız hesabınızı kontrol edin.`,
              actionUrl: '/dashboard/settings/profile',
              entityType: 'AUTH_ACCOUNT',
              entityId: account.id,
              dedupeKey: `security-account-unlinked:${account.id}`,
            });
          },
        },
      },
      session: {
        delete: {
          after: async (session, context) => {
            if (context?.path !== '/revoke-other-sessions') return;

            const minuteBucket = Math.floor(Date.now() / 60_000);
            await notifications.createForUser({
              recipientUserId: session.userId,
              type: NotificationType.SECURITY_SESSIONS_REVOKED,
              severity: NotificationSeverity.INFO,
              title: 'Diğer oturumlar sonlandırıldı',
              message:
                'Hesabınızın diğer cihazlardaki aktif oturumları kapatıldı.',
              actionUrl: '/dashboard/settings/profile',
              entityType: 'AUTH_USER',
              entityId: session.userId,
              dedupeKey: `security-sessions-revoked:${session.userId}:${minuteBucket}`,
            });
          },
        },
      },
    },
    socialProviders: {
      google: {
        clientId: requiredEnvironmentVariable('GOOGLE_CLIENT_ID'),
        clientSecret: requiredEnvironmentVariable('GOOGLE_CLIENT_SECRET'),
      },
      microsoft:
        microsoftClientId && microsoftClientSecret
          ? {
              clientId: microsoftClientId,
              clientSecret: microsoftClientSecret,
              tenantId: process.env.MICROSOFT_TENANT_ID?.trim() || 'common',
              prompt: 'select_account',
              // Read only the signed-in user's profile; no mailbox/offline access.
              disableDefaultScope: true,
              scope: ['openid', 'profile', 'email', 'User.Read'],
              disableProfilePhoto: false,
              profilePhotoSize: 64,
              overrideUserInfoOnSignIn: true,
            }
          : undefined,
    },
    onAPIError: {
      errorURL: new URL('/login', frontendURL).toString(),
    },
    trustedOrigins: [...trustedOrigins],
  });
}

type AppAuth = ReturnType<typeof createAppAuth>;

@Injectable()
export class AuthService {
  readonly auth: AppAuth;

  constructor(prisma: PrismaService, notifications: NotificationsService) {
    this.auth = createAppAuth(prisma, notifications);
  }
}

function authProviderLabel(providerId: string) {
  const labels: Record<string, string> = {
    google: 'Google',
    microsoft: 'Microsoft',
  };
  return labels[providerId] ?? providerId;
}
