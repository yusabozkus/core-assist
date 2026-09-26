import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import {
  selectAnnouncementAudience,
  announcementAudienceHash,
} from './admin-announcements.policy';
import {
  AnnouncementRole,
  PreviewAdminAnnouncementDto,
} from './dto/admin-announcement.dto';

type AudienceUser = Parameters<typeof selectAnnouncementAudience>[0][number];
function member(
  id: string,
  overrides: Partial<AudienceUser> = {},
): AudienceUser {
  return {
    id,
    name: id,
    email: `${id}@example.invalid`,
    emailVerified: true,
    ownedWorkspace: null,
    workspaceMembers: [
      { role: 'MEMBER', workspace: { id: 'workspace-1', name: 'Customer' } },
    ],
    storeMembers: [{ role: 'AGENT', store: { workspaceId: 'workspace-1' } }],
    ...overrides,
  };
}

void test('role targeting follows team access levels and excludes platform admins and noncustomers', () => {
  const users = [
    member('owner', {
      ownedWorkspace: { id: 'workspace-1', name: 'Customer' },
    }),
    member('manager', {
      workspaceMembers: [
        { role: 'ADMIN', workspace: { id: 'workspace-1', name: 'Customer' } },
      ],
    }),
    member('store-manager', {
      storeMembers: [{ role: 'ADMIN', store: { workspaceId: 'workspace-1' } }],
    }),
    member('agent'),
    member('viewer', {
      storeMembers: [{ role: 'VIEWER', store: { workspaceId: 'workspace-1' } }],
    }),
    member('platform'),
    member('outsider', { workspaceMembers: [], storeMembers: [] }),
  ];
  const all = selectAnnouncementAudience(
    users,
    Object.values(AnnouncementRole),
    ['PLATFORM@example.invalid'],
  );
  assert.equal(all.length, 5);
  assert.deepEqual(
    selectAnnouncementAudience(users, ['ACCOUNT_ADMIN'], []).map(
      (user) => user.userId,
    ),
    ['manager'],
  );
  assert.deepEqual(
    selectAnnouncementAudience(
      users,
      ['AGENT'],
      ['platform@example.invalid'],
    ).map((user) => user.userId),
    ['agent'],
  );
  assert.deepEqual(
    selectAnnouncementAudience(users, ['OWNER', 'VIEWER'], []).map(
      (user) => user.userId,
    ),
    ['owner', 'viewer'],
  );
});

void test('multiple stores never duplicate recipients or leak roles from another workspace', () => {
  const user = member('agent', {
    storeMembers: [
      { role: 'AGENT', store: { workspaceId: 'workspace-1' } },
      { role: 'AGENT', store: { workspaceId: 'workspace-1' } },
      { role: 'ADMIN', store: { workspaceId: 'other-workspace' } },
    ],
  });
  assert.equal(
    selectAnnouncementAudience([user, user], ['AGENT', 'STORE_ADMIN'], [])
      .length,
    1,
  );
  assert.equal(
    selectAnnouncementAudience([user], ['STORE_ADMIN'], []).length,
    0,
  );
});

void test('preview hash is stable across ordering and changes when address verification or role changes', () => {
  const a = member('a');
  const b = member('b');
  const select = (users: AudienceUser[]) =>
    selectAnnouncementAudience(users, Object.values(AnnouncementRole), []);
  const original = announcementAudienceHash(select([a, b]));
  assert.equal(original, announcementAudienceHash(select([b, a])));
  assert.notEqual(
    original,
    announcementAudienceHash(select([a, { ...b, emailVerified: false }])),
  );
  assert.notEqual(
    original,
    announcementAudienceHash(
      select([
        a,
        { ...b, ownedWorkspace: { id: 'workspace-1', name: 'Customer' } },
      ]),
    ),
  );
});

void test('announcement endpoints enforce authentication, admin access and origin on both POST actions', () => {
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA, AdminAnnouncementsController),
    [AuthGuard, AdminGuard],
  );
  for (const action of ['preview', 'publish'] as const) {
    assert.deepEqual(
      Reflect.getMetadata(
        GUARDS_METADATA,
        Reflect.get(AdminAnnouncementsController.prototype, action) as object,
      ),
      [AdminActionOriginGuard],
    );
  }
});

void test('preview validation rejects empty or invalid roles, unsafe subject and implicit email flags', async () => {
  const valid = {
    title: '  Bakım  ',
    message: '  Bilgilendirme  ',
    roles: ['AGENT'],
    sendEmail: false,
  };
  const input = plainToInstance(PreviewAdminAnnouncementDto, valid);
  assert.equal((await validate(input)).length, 0);
  assert.equal(input.title, 'Bakım');
  for (const override of [
    { title: '   ' },
    { message: ' ' },
    { title: 'A\r\nBcc: other' },
    { message: 'x'.repeat(1001) },
    { roles: [] },
    { roles: ['AGENT', 'AGENT'] },
    { roles: ['SUPER_ADMIN'] },
    { roles: 'AGENT' },
    { sendEmail: 'false' },
    { sendEmail: undefined },
  ])
    assert.ok(
      (
        await validate(
          plainToInstance(PreviewAdminAnnouncementDto, {
            ...valid,
            ...override,
          }),
        )
      ).length > 0,
    );
});
