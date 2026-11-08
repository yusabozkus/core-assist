import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { PrismaService } from '../../database/prisma.service';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { isConfiguredAdminIdentity } from '../admin/admin-access.policy';
import { AuthService } from '../auth/auth.service';
import { authRuntimeConfig } from '../auth/auth-runtime.config';
import type { AuditLogService } from '../audit/audit-log.service';
import type { BillingEntitlementService } from '../billing/billing-entitlement.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { TeamAccessLevel } from '../team/dto/team-member-access.dto';
import { TeamController } from '../team/team.controller';
import type { TeamInvitationEmailService } from '../team/team-invitation-email.service';
import type { TeamEventEmailService } from '../team/team-event-email.service';
import { TeamService } from '../team/team.service';
import { AccountDeletionService } from './account-deletion.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const frontendOrigin = 'https://app.example.test';
const siblingOrigin = 'https://untrusted.example.test';
const testCookie = 'audit-session=offline-owner';

function teamFixture(role: WorkspaceRole | null = WorkspaceRole.OWNER) {
  const writes: unknown[] = [];
  const transaction = {
    workspaceMember: {
      findUnique: () => Promise.resolve(role ? { id: 'member', role } : null),
    },
    $queryRaw: () => Promise.resolve([{ id: workspaceId }]),
    workspaceInvitation: {
      updateMany: () => Promise.resolve({ count: 0 }),
      findFirst: () => Promise.resolve(null),
      create: ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return Promise.resolve({
          ...data,
          id: 'invitation',
          createdAt: new Date(),
          storeAccesses: [],
          invitedBy: { id: 'owner', name: 'Offline owner' },
        });
      },
    },
    user: { findFirst: () => Promise.resolve(null) },
    store: { findMany: () => Promise.resolve([]) },
  };
  const prisma = {
    ...transaction,
    $transaction: <T>(action: (tx: unknown) => Promise<T>) =>
      action(transaction),
  };
  const service = new TeamService(
    prisma as unknown as PrismaService,
    {
      assertMemberCapacityInTransaction: () => Promise.resolve(),
    } as unknown as BillingEntitlementService,
    {} as NotificationsService,
    { record: () => Promise.resolve() } as unknown as AuditLogService,
    {
      stage: () => Promise.resolve('offline-email'),
      deliver: () => Promise.resolve('QUEUED'),
    } as unknown as TeamInvitationEmailService,
    {} as TeamEventEmailService,
  );
  return { service, writes };
}

void test('security audit: invitation grants require workspace owner authority', async () => {
  for (const role of [null, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN]) {
    const fixture = teamFixture(role);
    await assert.rejects(
      fixture.service.createInvitation(workspaceId, 'caller', {
        email: 'attacker@example.test',
        accessLevel: TeamAccessLevel.ACCOUNT_ADMIN,
      }),
      { status: 403 },
    );
    assert.equal(fixture.writes.length, 0);
  }
});

void test('security audit: invitation acceptance rejects unverified email before any database work', async () => {
  const service = teamFixture().service;
  await assert.rejects(
    service.acceptInvitation('x'.repeat(43), {
      id: 'invitee',
      email: 'invitee@example.test',
      name: 'Invitee',
      emailVerified: false,
    }),
    { status: 403 },
  );
});

void test('security audit: platform administration requires both verified email and explicit allowlist membership', () => {
  const allowed = new Set(['admin@example.test']);
  assert.equal(
    isConfiguredAdminIdentity(
      { email: 'admin@example.test', emailVerified: false },
      allowed,
    ),
    false,
  );
  assert.equal(
    isConfiguredAdminIdentity(
      { email: 'other@example.test', emailVerified: true },
      allowed,
    ),
    false,
  );
  assert.equal(
    isConfiguredAdminIdentity(
      { email: ' ADMIN@EXAMPLE.TEST ', emailVerified: true },
      allowed,
    ),
    true,
  );
});

void test('security audit: stale or revoked sessions cannot close billing or delete accounts', async () => {
  for (const session of [
    null,
    { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  ]) {
    let inspected = false;
    const prisma = {
      session: {
        findFirst: (input: {
          where: { id: string; userId: string; expiresAt: { gt: Date } };
        }) => {
          assert.equal(input.where.id, 'session');
          assert.equal(input.where.userId, 'owner');
          assert.ok(input.where.expiresAt.gt instanceof Date);
          return Promise.resolve(session);
        },
      },
      workspace: {
        findMany: () => {
          inspected = true;
          return Promise.resolve([]);
        },
      },
    };
    const service = new AccountDeletionService(
      prisma as unknown as PrismaService,
      {} as AuditLogService,
    );
    await assert.rejects(service.deleteAccount('owner', 'session'), {
      status: 403,
    });
    await assert.rejects(service.closeBilling('owner', 'session'), {
      status: 403,
    });
    assert.equal(inspected, false);
  }
});

void test('security audit: account closure inspects only owned workspaces', async () => {
  const seen: unknown[] = [];
  const service = new AccountDeletionService(
    {
      workspace: {
        findMany: (input: { where: unknown }) => {
          seen.push(input.where);
          return Promise.resolve([]);
        },
      },
    } as unknown as PrismaService,
    {} as AuditLogService,
  );
  const status = await service.getStatus('account-owner');
  assert.deepEqual(seen, [{ ownerId: 'account-owner' }]);
  assert.equal(status.canDelete, true);
});

void test('security audit: production auth rejects HTTP and public-suffix cookie scope', () => {
  assert.throws(() =>
    authRuntimeConfig({
      NODE_ENV: 'production',
      FRONTEND_URL: frontendOrigin,
      BETTER_AUTH_URL: 'http://api.example.test',
      AUTH_COOKIE_DOMAIN: 'example.test',
    }),
  );
  assert.throws(() =>
    authRuntimeConfig({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://first.github.io',
      BETTER_AUTH_URL: 'https://second.github.io',
      AUTH_COOKIE_DOMAIN: 'github.io',
    }),
  );
});

// Evidence tests characterize the current defect rather than fixing it. The
// server is an isolated Nest module with actual controllers, AuthGuard and
// TeamService, mocked session/database/email, and no real application modules.
// Cookies are explicitly supplied: browser SameSite behavior is NOT simulated.
// Exploitation requires a browser context that sends cookies (e.g. a same-site
// sibling origin); unrelated-site POSTs with Lax cookies are not demonstrated.
void test('security audit HTTP: team form POST accepts an untrusted origin while destructive account actions reject it', async (t) => {
  const fixture = teamFixture();
  const originalFrontend = process.env.FRONTEND_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.FRONTEND_URL = frontendOrigin;
  process.env.NODE_ENV = 'production';
  let accountActions = 0;
  const authService = {
    auth: {
      api: {
        getSession: ({ headers }: { headers: Headers }) =>
          Promise.resolve(
            headers.get('cookie') === testCookie
              ? {
                  user: {
                    id: 'owner',
                    name: 'Offline owner',
                    email: 'owner@example.test',
                    emailVerified: true,
                  },
                  session: { id: 'session', userId: 'owner' },
                }
              : null,
          ),
      },
    },
  };
  @Module({
    controllers: [TeamController, UsersController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: TeamService, useValue: fixture.service },
      { provide: UsersService, useValue: {} },
      {
        provide: AccountDeletionService,
        useValue: {
          deleteAccount: () => {
            accountActions++;
            return Promise.resolve({ success: true });
          },
          closeBilling: () => {
            accountActions++;
            return Promise.resolve({ canDelete: true });
          },
        },
      },
    ],
  })
  class SecurityAuditModule {}

  const app = await NestFactory.create<NestExpressApplication>(
    SecurityAuditModule,
    { logger: false },
  );
  try {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.enableCors({ origin: [frontendOrigin], credentials: true });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const invite = (cookie: string | undefined, origin: string) =>
      fetch(`${base}/workspaces/${workspaceId}/team/invitations`, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/x-www-form-urlencoded',
          ...(cookie ? { cookie } : {}),
        },
        body: new URLSearchParams({
          email: 'attacker@example.test',
          accessLevel: 'ACCOUNT_ADMIN',
        }),
      });

    await t.test(
      'unauthenticated form requests cannot create invitations',
      async () => {
        const response = await invite(undefined, siblingOrigin);
        assert.equal(response.status, 401);
        await response.arrayBuffer();
        assert.equal(fixture.writes.length, 0);
      },
    );
    await t.test(
      'known gap: authenticated simple POST grants account admin despite disallowed Origin',
      async () => {
        const response = await invite(testCookie, siblingOrigin);
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        const body = (await response.json()) as {
          invitation: { accessLevel: string };
        };
        assert.equal(body.invitation.accessLevel, 'ACCOUNT_ADMIN');
        assert.equal(fixture.writes.length, 1);
      },
    );
    await t.test(
      'account deletion and billing closure reject untrusted origins',
      async () => {
        for (const [route, confirmation] of [
          ['delete', 'HESABIMI SİL'],
          ['close-billing', 'TAHSİLATI DURDUR'],
        ]) {
          const response = await fetch(`${base}/users/me/${route}`, {
            method: 'POST',
            headers: {
              origin: siblingOrigin,
              cookie: testCookie,
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ confirmation }),
          });
          assert.equal(response.status, 403);
          await response.arrayBuffer();
        }
        assert.equal(accountActions, 0);
      },
    );
    await t.test(
      'account deletion rejects missing Origin and wrong confirmation',
      async () => {
        for (const [origin, confirmation, expectedStatus] of [
          [undefined, 'HESABIMI SİL', 403],
          [frontendOrigin, 'DELETE', 400],
        ] as const) {
          const response = await fetch(`${base}/users/me/delete`, {
            method: 'POST',
            headers: {
              ...(origin ? { origin } : {}),
              cookie: testCookie,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ confirmation }),
          });
          assert.equal(response.status, expectedStatus);
          await response.arrayBuffer();
        }
        assert.equal(accountActions, 0);
      },
    );
  } finally {
    await app.close();
    if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontend;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
