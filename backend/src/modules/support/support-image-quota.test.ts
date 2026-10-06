import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { Prisma, SupportTicketStatus } from '../../generated/prisma/client';
import type { WorkspacesService } from '../workspaces/workspaces.service';
import type { AuditLogService } from '../audit/audit-log.service';
import { AdminSupportService } from '../admin/admin-support.service';
import type { AdminAccessService } from '../admin/admin-access.service';
import { AdminSupportMessageVisibility } from '../admin/dto/admin-support-message.dto';
import { TransactionLocks } from '../../../test/transaction-locks';
import { SupportService } from './support.service';
import type { SupportNotificationService } from './support-notification.service';
import {
  MAX_SUPPORT_WORKSPACE_IMAGE_BYTES,
  type SupportAttachmentService,
  type StoredSupportImage,
} from './support-attachment.service';

const MB = 1024 * 1024;
const image = (size = 4 * MB): StoredSupportImage => ({
  objectKey: `support/${randomUUID()}`,
  contentType: 'image/png',
  size,
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function fixture(
  initialBytes = 506 * MB,
  status: SupportTicketStatus = SupportTicketStatus.OPEN,
) {
  const locks = new TransactionLocks();
  const date = new Date('2026-10-01T00:00:00Z');
  const tickets = new Map(
    ['a', 'b', 'other'].map((id, index) => [
      id,
      {
        id,
        workspaceId: id === 'other' ? 'other-workspace' : 'workspace',
        number: index + 1,
        subject: 'Local test ticket',
        category: 'OTHER',
        impact: 'QUESTION',
        priority: 'NORMAL',
        planSnapshot: 'STARTER',
        status,
        createdAt: date,
        updatedAt: date,
        lastMessageAt: date,
        firstResponseDueAt: date,
        firstRespondedAt: null as Date | null,
        resolvedAt: null,
        closedAt: null,
        assignedAdminUserId: null,
        storeId: null,
        createdByUserId: id === 'other' ? 'other-customer' : 'customer',
      },
    ]),
  );
  type Ticket = NonNullable<ReturnType<typeof tickets.get>>;
  type MessageData = {
    ticketId: string;
    authorUserId?: string;
    body: string;
    authorType: string;
    isInternal?: boolean;
    attachments?: { create: StoredSupportImage[] };
  };
  type Message = MessageData & { id: string; createdAt: Date };
  type Attachment = StoredSupportImage & {
    workspaceId: string;
    messageId: string;
  };
  const messages: Message[] = [];
  const attached: Attachment[] = [];
  const discarded: string[] = [];
  const used = new Map([
    ['workspace', initialBytes],
    ['other-workspace', initialBytes],
  ]);
  const operations: string[][] = [];
  let emitted = 0;
  let aggregates = 0;
  let uploads = 0;
  let failNotification = false;
  let failAudit = false;
  let onNotify: ((ticket: Ticket) => Promise<void>) | undefined;

  const detail = (id: string, includeInternal = true) => {
    const ticket = tickets.get(id);
    if (!ticket) return null;
    return {
      ...ticket,
      store: null,
      createdBy: null,
      assignedAdmin: null,
      workspace: { id: ticket.workspaceId, name: 'Test account' },
      messages: messages
        .filter(
          (row) => row.ticketId === id && (includeInternal || !row.isInternal),
        )
        .map((row) => ({
          ...row,
          author: null,
          attachments: attached.filter((file) => file.messageId === row.id),
        })),
      _count: {
        messages: messages.filter((row) => row.ticketId === id).length,
      },
    };
  };
  const membership = ({ where }: { where: { userId: string } }) =>
    Promise.resolve({
      role: 'OWNER',
      workspaceId:
        where.userId === 'other-customer' ? 'other-workspace' : 'workspace',
      workspace: {
        id: 'workspace',
        name: 'Test account',
        billingSubscription: null,
      },
    });
  const prisma = {
    workspaceMember: { findUnique: membership },
    supportTicket: {
      findFirst: ({ where }: { where: { id: string; workspaceId: string } }) =>
        Promise.resolve(
          tickets.get(where.id)?.workspaceId === where.workspaceId
            ? detail(where.id, false)
            : null,
        ),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(detail(where.id)),
    },
    $transaction: <T>(
      action: (tx: unknown) => Promise<T>,
      options: { isolationLevel: string },
    ) => {
      assert.equal(
        options.isolationLevel,
        Prisma.TransactionIsolationLevel.ReadCommitted,
      );
      return locks.run(async (lock) => {
        const ops: string[] = [];
        operations.push(ops);
        const pendingMessages: Message[] = [];
        const pendingAttachments: Attachment[] = [];
        const updates = new Map<string, Partial<Ticket>>();
        const tx = {
          workspaceMember: { findUnique: membership },
          $queryRaw: async (
            parts: TemplateStringsArray | Prisma.Sql,
            ...values: unknown[]
          ) => {
            const query = 'text' in parts ? parts.text : parts.join('?');
            const params: unknown[] = 'text' in parts ? parts.values : values;
            const id = params[0] as string;
            const ticket = tickets.get(id);
            if (!ticket) return [];
            if (query.includes('FOR KEY SHARE OF person')) {
              if (params.length === 3 && params[1] !== ticket.workspaceId)
                return [];
              const users = new Set([
                ticket.workspaceId === 'workspace'
                  ? 'customer'
                  : 'other-customer',
                ticket.createdByUserId,
                params.at(-1) as string,
              ]);
              for (const userId of [...users].sort())
                await lock(`user:${userId}`);
              ops.push('users');
              return [...users].map((userId) => ({ id: userId }));
            }
            if (query.includes('FOR NO KEY UPDATE OF workspace')) {
              if (params[1] && params[1] !== ticket.workspaceId) return [];
              await lock(`workspace:${ticket.workspaceId}`);
              ops.push('workspace');
              return [{ id: ticket.workspaceId }];
            }
            assert.match(query, /FOR UPDATE/);
            await lock(`ticket:${id}`);
            ops.push('ticket');
            return [{ ...tickets.get(id) }];
          },
          supportAttachment: {
            aggregate: ({
              where,
            }: {
              where: { message: { ticket: { workspaceId: string } } };
            }) => {
              aggregates++;
              ops.push('count');
              const workspaceId = where.message.ticket.workspaceId;
              return Promise.resolve({
                _sum: {
                  size:
                    (used.get(workspaceId) ?? 0) +
                    attached
                      .filter((file) => file.workspaceId === workspaceId)
                      .reduce((sum, file) => sum + file.size, 0),
                },
              });
            },
          },
          supportMessage: {
            create: async ({ data }: { data: MessageData }) => {
              // Simulate the FK's KEY SHARE lock against user deletion.
              if (data.authorUserId) await lock(`user:${data.authorUserId}`);
              ops.push('insert');
              const message = {
                ...data,
                id: randomUUID(),
                createdAt: new Date(),
              };
              pendingMessages.push(message);
              pendingAttachments.push(
                ...(data.attachments?.create ?? []).map((file) => ({
                  ...file,
                  messageId: message.id,
                  workspaceId: tickets.get(data.ticketId)!.workspaceId,
                })),
              );
              return { id: message.id };
            },
          },
          supportTicket: {
            update: ({
              where,
              data,
            }: {
              where: { id: string };
              data: Partial<Ticket>;
            }) => {
              updates.set(where.id, data);
              return Promise.resolve({ ...tickets.get(where.id), ...data });
            },
          },
        };
        const result = await action(tx);
        messages.push(...pendingMessages);
        attached.push(...pendingAttachments);
        for (const [id, data] of updates) Object.assign(tickets.get(id)!, data);
        ops.push('commit');
        return result;
      });
    },
  };
  const notify = async (_tx: unknown, ticket: Ticket) => {
    await onNotify?.(ticket);
    if (failNotification) {
      failNotification = false;
      throw new Error('Notification failed');
    }
    return ['recipient'];
  };
  const notifications = {
    notifyCustomerMessage: notify,
    notifyAdminReply: notify,
    resolveSlaNotification: () => Promise.resolve([]),
    emitCreated: (recipients: string[]) => {
      emitted += recipients.length;
    },
    emitRead: () => {},
  } as unknown as SupportNotificationService;
  const attachments = {
    upload: () => {
      uploads++;
      return Promise.resolve([image()]);
    },
    discardUnattached: (images: StoredSupportImage[]) => {
      discarded.push(...images.map((file) => file.objectKey));
      return Promise.resolve();
    },
  } as unknown as SupportAttachmentService;
  const audit = {
    record: () => {
      if (failAudit) {
        failAudit = false;
        throw new Error('Audit failed');
      }
      return Promise.resolve();
    },
  } as unknown as AuditLogService;
  return {
    tickets,
    attached,
    messages,
    discarded,
    operations,
    get emitted() {
      return emitted;
    },
    get aggregates() {
      return aggregates;
    },
    get uploads() {
      return uploads;
    },
    bytes: (workspaceId = 'workspace') =>
      (used.get(workspaceId) ?? 0) +
      attached
        .filter((file) => file.workspaceId === workspaceId)
        .reduce((sum, file) => sum + file.size, 0),
    failNextNotification: () => {
      failNotification = true;
    },
    failNextAudit: () => {
      failAudit = true;
    },
    onNotify: (callback: (ticket: Ticket) => Promise<void>) => {
      onNotify = callback;
    },
    deleteWorkspace: (beforeWorkspace: () => Promise<void>) =>
      locks.run(async (lock) => {
        await lock('user:customer');
        await beforeWorkspace();
        await lock('workspace:workspace');
        for (const [id, ticket] of tickets)
          if (ticket.workspaceId === 'workspace') tickets.delete(id);
      }),
    customer: new SupportService(
      prisma as unknown as PrismaService,
      notifications,
      {} as WorkspacesService,
      attachments,
    ),
    admin: new AdminSupportService(
      prisma as unknown as PrismaService,
      {} as AdminAccessService,
      audit,
      notifications,
      attachments,
    ),
  };
}

const reply = { message: 'Test customer message' };
const adminReply = {
  message: 'Test admin message',
  visibility: AdminSupportMessageVisibility.PUBLIC,
};

function assertQuotaRejected(result: PromiseSettledResult<unknown>) {
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  assert.ok(result.reason instanceof BadRequestException);
  assert.equal(result.reason.getStatus(), 400);
  assert.match(result.reason.message, /depolama sınırına/);
}

void test(
  '506 MiB plus parallel 4 MiB images on different customer tickets never exceeds 512 MiB',
  { timeout: 3000 },
  async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.customer.reply('a', 'customer', reply, [image()]),
      f.customer.reply('b', 'customer', reply, [image()]),
    ]);
    assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
    results
      .filter((row) => row.status === 'rejected')
      .forEach(assertQuotaRejected);
    assert.equal(f.bytes(), 510 * MB);
    assert.equal(f.attached.length, 1);
    assert.equal(f.messages.length, 1);
    assert.equal(f.emitted, 1);
    for (const ops of f.operations)
      assert.deepEqual(ops.slice(0, 4), [
        'users',
        'workspace',
        'ticket',
        'count',
      ]);
  },
);

void test('customer replies and admin internal notes share the same workspace quota', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.customer.reply('a', 'customer', reply, [image()]),
    f.admin.addMessage(
      'b',
      'admin',
      { ...adminReply, visibility: AdminSupportMessageVisibility.INTERNAL },
      [image()],
    ),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  results
    .filter((row) => row.status === 'rejected')
    .forEach(assertQuotaRejected);
  assert.equal(f.bytes(), 510 * MB);
});

void test('parallel admin replies also serialize and exact quota usage is allowed', async () => {
  const f = fixture(508 * MB);
  const results = await Promise.allSettled([
    f.admin.addMessage('a', 'admin', adminReply, [image()]),
    f.admin.addMessage('b', 'admin', adminReply, [image()]),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  results
    .filter((row) => row.status === 'rejected')
    .forEach(assertQuotaRejected);
  assert.equal(f.bytes(), MAX_SUPPORT_WORKSPACE_IMAGE_BYTES);
  assertQuotaRejected(
    (
      await Promise.allSettled([
        f.customer.reply('b', 'customer', reply, [image(1)]),
      ])
    )[0],
  );
});

void test(
  'notification and audit failures release locks and do not reserve unused image space',
  { timeout: 3000 },
  async () => {
    const f = fixture(508 * MB);
    f.failNextNotification();
    await assert.rejects(
      f.customer.reply('a', 'customer', reply, [image()]),
      /Notification failed/,
    );
    f.failNextAudit();
    await assert.rejects(
      f.admin.addMessage('b', 'admin', adminReply, [image()]),
      /Audit failed/,
    );
    assert.equal(f.bytes(), 508 * MB);
    assert.equal(f.messages.length, 0);
    assert.equal(f.emitted, 0);
    await f.customer.reply('b', 'customer', reply, [image()]);
    assert.equal(f.bytes(), 512 * MB);
  },
);

void test('rejected customer and admin uploads retain cleanup for unattached B2 images', async () => {
  const f = fixture(MAX_SUPPORT_WORKSPACE_IMAGE_BYTES);
  await assert.rejects(
    f.customer.replyWithImages('a', 'customer', reply.message, []),
    /depolama sınırına/,
  );
  await assert.rejects(
    f.admin.addMessageWithImages('b', 'admin', adminReply, []),
    /depolama sınırına/,
  );
  assert.equal(f.uploads, 2);
  assert.equal(f.discarded.length, 2);
  assert.equal(f.attached.length, 0);
  assert.equal(f.messages.length, 0);
});

void test('text messages remain allowed when storage is full, without a workspace quota lock', async () => {
  const f = fixture(MAX_SUPPORT_WORKSPACE_IMAGE_BYTES);
  await f.customer.reply('a', 'customer', reply);
  await f.admin.addMessage('b', 'admin', adminReply);
  assert.equal(f.messages.length, 2);
  assert.equal(f.aggregates, 0);
  assert.ok(f.operations.every((ops) => !ops.includes('workspace')));
});

void test(
  'a blocked transaction in one account does not block another account',
  { timeout: 3000 },
  async (t) => {
    const f = fixture();
    const entered = deferred(),
      release = deferred();
    t.after(() => release.resolve());
    f.onNotify(async (ticket) => {
      if (ticket.workspaceId !== 'workspace') return;
      entered.resolve();
      await release.promise;
    });
    const pending = f.customer.reply('a', 'customer', reply, [image()]);
    await entered.promise;
    await f.customer.reply('other', 'other-customer', reply, [image()]);
    assert.equal(f.bytes('other-workspace'), 510 * MB);
    assert.equal(f.bytes(), 506 * MB);
    release.resolve();
    await pending;
    assert.equal(f.bytes(), 510 * MB);
  },
);

void test('foreign and closed tickets cannot consume storage quota', async () => {
  const f = fixture();
  await assert.rejects(
    f.customer.reply('other', 'customer', reply, [image()]),
    NotFoundException,
  );
  f.tickets.get('a')!.status = SupportTicketStatus.CLOSED;
  await assert.rejects(
    f.customer.reply('a', 'customer', reply, [image()]),
    /yeniden açmalısınız/,
  );
  await assert.rejects(
    f.admin.addMessage('a', 'admin', adminReply, [image()]),
    /yeniden açmalısınız/,
  );
  assert.equal(f.aggregates, 0);
  assert.equal(f.attached.length, 0);
  assert.equal(f.messages.length, 0);
});

void test(
  'account deletion starting before image registration cannot deadlock on user/workspace FKs',
  { timeout: 3000 },
  async (t) => {
    const f = fixture();
    const userLocked = deferred(),
      continueDeletion = deferred();
    t.after(() => continueDeletion.resolve());
    const deletion = f.deleteWorkspace(async () => {
      userLocked.resolve();
      await continueDeletion.promise;
    });
    await userLocked.promise;
    const registration = f.customer.reply('a', 'customer', reply, [image()]);
    // Let registration reach the initial shared user lock before deletion continues.
    await Promise.resolve();
    await Promise.resolve();
    continueDeletion.resolve();
    await deletion;
    await assert.rejects(registration, NotFoundException);
    assert.equal(f.attached.length, 0);
    assert.equal(f.messages.length, 0);
  },
);
