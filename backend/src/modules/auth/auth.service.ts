import { Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { lastLoginMethod } from 'better-auth/plugins';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditActorType,
  AuditOrigin,
  AuditResult,
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { isConfiguredAdminIdentity } from '../admin/admin-access.policy';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { authRuntimeConfig } from './auth-runtime.config';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

function createAppAuth(
  prisma: PrismaService,
  notifications: NotificationsService,
  audit: AuditLogService,
) {
  const { frontendURL, options: runtimeOptions } = authRuntimeConfig();
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

  if (Boolean(microsoftClientId) !== Boolean(microsoftClientSecret)) {
    throw new Error(
      'MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured together.',
    );
  }

  return betterAuth({
    ...runtimeOptions,
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secret: requiredEnvironmentVariable('BETTER_AUTH_SECRET'),
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
        // Linking is initiated from an authenticated account settings page.
        // Microsoft often omits a verified-email claim even for a valid OAuth identity.
        trustedProviders: ['microsoft'],
        // A user may own Google and Microsoft identities with different emails.
        allowDifferentEmails: true,
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
            const [accountCount, user] = await Promise.all([
              prisma.account.count({ where: { userId: account.userId } }),
              findAuditUser(prisma, account.userId),
            ]);
            if (accountCount < 2) return;

            const isAdmin = Boolean(user && isConfiguredAdminIdentity(user));
            await Promise.all([
              notifications.createForUser({
                recipientUserId: account.userId,
                type: NotificationType.SECURITY_ACCOUNT_CHANGED,
                severity: NotificationSeverity.INFO,
                title: 'Yeni giriş yöntemi bağlandı',
                message: `${authProviderLabel(account.providerId)} hesabı Core Asistan profilinize bağlandı. Bu işlemi siz yapmadıysanız bağlı hesaplarınızı kontrol edin.`,
                actionUrl: isAdmin
                  ? '/admin/account'
                  : '/dashboard/settings/profile',
                entityType: 'AUTH_ACCOUNT',
                entityId: account.id,
                dedupeKey: `security-account-linked:${account.id}`,
                securityEmail: {
                  kind: 'PROVIDER_LINKED',
                  provider: authProviderLabel(account.providerId),
                },
              }),
              isAdmin && user
                ? audit.recordSafely({
                    actorType: AuditActorType.ADMIN,
                    actorUserId: user.id,
                    actorName: user.name,
                    actorEmail: user.email,
                    origin: AuditOrigin.API,
                    action: AuditAction.ADMIN_AUTH_PROVIDER_LINKED,
                    result: AuditResult.SUCCESS,
                    targetType: 'AUTH_ACCOUNT',
                    targetId: account.id,
                    after: { providerId: account.providerId, linked: true },
                  })
                : Promise.resolve(null),
            ]);
          },
        },
        delete: {
          after: async (account) => {
            const user = await findAuditUser(prisma, account.userId);
            const isAdmin = Boolean(user && isConfiguredAdminIdentity(user));
            await Promise.all([
              notifications.createForUser({
                recipientUserId: account.userId,
                type: NotificationType.SECURITY_ACCOUNT_CHANGED,
                severity: NotificationSeverity.WARNING,
                title: 'Giriş yöntemi kaldırıldı',
                message: `${authProviderLabel(account.providerId)} hesabı Core Asistan profilinizden kaldırıldı. Bu işlemi siz yapmadıysanız hesabınızı kontrol edin.`,
                actionUrl: isAdmin
                  ? '/admin/account'
                  : '/dashboard/settings/profile',
                entityType: 'AUTH_ACCOUNT',
                entityId: account.id,
                dedupeKey: `security-account-unlinked:${account.id}`,
                securityEmail: {
                  kind: 'PROVIDER_REMOVED',
                  provider: authProviderLabel(account.providerId),
                },
              }),
              isAdmin && user
                ? audit.recordSafely({
                    actorType: AuditActorType.ADMIN,
                    actorUserId: user.id,
                    actorName: user.name,
                    actorEmail: user.email,
                    origin: AuditOrigin.API,
                    action: AuditAction.ADMIN_AUTH_PROVIDER_UNLINKED,
                    result: AuditResult.SUCCESS,
                    targetType: 'AUTH_ACCOUNT',
                    targetId: account.id,
                    before: { providerId: account.providerId, linked: true },
                    after: { providerId: account.providerId, linked: false },
                  })
                : Promise.resolve(null),
            ]);
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            const user = await findAuditUser(prisma, session.userId);
            if (!user || !isConfiguredAdminIdentity(user)) return;

            const providerId =
              typeof context?.params?.id === 'string'
                ? context.params.id
                : null;
            await audit.recordSafely({
              actorType: AuditActorType.ADMIN,
              actorUserId: user.id,
              actorName: user.name,
              actorEmail: user.email,
              origin: AuditOrigin.API,
              action: AuditAction.ADMIN_SIGNED_IN,
              result: AuditResult.SUCCESS,
              targetType: 'AUTH_SESSION',
              targetId: session.id,
              metadata: {
                providerId,
                authPath: context?.path ?? null,
              },
            });
          },
        },
        delete: {
          after: async (session, context) => {
            const isBulkRevocation = context?.path === '/revoke-other-sessions';
            const isSingleRevocation = context?.path === '/revoke-session';
            if (!isBulkRevocation && !isSingleRevocation) return;

            const user = await findAuditUser(prisma, session.userId);
            const isAdmin = Boolean(user && isConfiguredAdminIdentity(user));
            const minuteBucket = Math.floor(Date.now() / 60_000);
            const notification = isBulkRevocation
              ? notifications.createForUser({
                  recipientUserId: session.userId,
                  type: NotificationType.SECURITY_SESSIONS_REVOKED,
                  severity: NotificationSeverity.INFO,
                  title: 'Diğer oturumlar sonlandırıldı',
                  message:
                    'Hesabınızın diğer cihazlardaki aktif oturumları kapatıldı.',
                  actionUrl: isAdmin
                    ? '/admin/account'
                    : '/dashboard/settings/profile',
                  entityType: 'AUTH_USER',
                  entityId: session.userId,
                  dedupeKey: `security-sessions-revoked:${session.userId}:${minuteBucket}`,
                  securityEmail: { kind: 'OTHER_SESSIONS_REVOKED' },
                })
              : Promise.resolve(null);
            const auditEntry =
              isAdmin && user
                ? audit.recordSafely({
                    actorType: AuditActorType.ADMIN,
                    actorUserId: user.id,
                    actorName: user.name,
                    actorEmail: user.email,
                    origin: AuditOrigin.API,
                    action: AuditAction.ADMIN_OTHER_SESSION_REVOKED,
                    result: AuditResult.SUCCESS,
                    targetType: 'AUTH_SESSION',
                    targetId: session.id,
                    before: { active: true },
                    after: { active: false },
                    metadata: {
                      scope: isBulkRevocation
                        ? 'OTHER_SESSIONS'
                        : 'SELECTED_SESSION',
                    },
                  })
                : Promise.resolve(null);
            await Promise.all([notification, auditEntry]);
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
  });
}

type AppAuth = ReturnType<typeof createAppAuth>;

@Injectable()
export class AuthService {
  readonly auth: AppAuth;

  constructor(
    prisma: PrismaService,
    notifications: NotificationsService,
    audit: AuditLogService,
  ) {
    this.auth = createAppAuth(prisma, notifications, audit);
  }
}

function findAuditUser(prisma: PrismaService, userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
    },
  });
}

function authProviderLabel(providerId: string) {
  const labels: Record<string, string> = {
    google: 'Google',
    microsoft: 'Microsoft',
  };
  return labels[providerId] ?? providerId;
}
