import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminEmailsController } from './admin-emails.controller';
import {
  adminEmailSelect,
  emailListWhere,
  emailScopeWhere,
} from './admin-emails.service';
import { AdminEmailsQueryDto } from './dto/admin-emails-query.dto';

void test('all admin email routes require both session and admin guards', () => {
  const guards = Reflect.getMetadata(
    GUARDS_METADATA,
    AdminEmailsController,
  ) as unknown[];
  assert.deepEqual(guards, [AuthGuard, AdminGuard]);
});

void test('list selection excludes content, token-bearing delivery keys and claim tokens', () => {
  for (const field of ['html', 'deliveryKey', 'claimToken', 'claimUntil'])
    assert.equal(Object.hasOwn(adminEmailSelect, field), false);
});

void test('workspace scoping uses explicit account or store ownership, never recipient identity', () => {
  assert.deepEqual(emailScopeWhere({ workspaceId: 'account-a' }), {
    OR: [{ workspaceId: 'account-a' }, { store: { workspaceId: 'account-a' } }],
  });
  const where = emailListWhere(
    Object.assign(new AdminEmailsQueryDto(), {
      workspaceId: 'account-a',
      q: 'search',
      deliveryStatus: 'UNKNOWN',
    }),
  );
  assert.deepEqual(
    (where.AND as unknown[])[0],
    emailScopeWhere({ workspaceId: 'account-a' }),
  );
  assert.ok(JSON.stringify(where).includes('"providerMessage":null'));
});

void test('invalid filters and unbounded pagination fail validation', async () => {
  for (const input of [
    { page: 0 },
    { pageSize: 1000 },
    { page: 1.5 },
    { workspaceId: 'invalid' },
    { status: 'DELIVERED' },
    { from: 'yesterday' },
    { deliveryStatus: 'OPENED' },
  ]) {
    assert.ok(
      (await validate(plainToInstance(AdminEmailsQueryDto, input))).length > 0,
    );
  }
  assert.throws(() =>
    emailListWhere(
      Object.assign(new AdminEmailsQueryDto(), {
        from: '2026-09-26T00:00:00Z',
        to: '2026-09-25T00:00:00Z',
      }),
    ),
  );
});
