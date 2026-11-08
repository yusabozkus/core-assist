import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import type { PrismaService } from '../../database/prisma.service';
import type { WorkspacesService } from '../workspaces/workspaces.service';
import { isConfiguredAdminIdentity } from '../admin/admin-access.policy';
import {
  isPublicPushAddress,
  validatePushEndpoint,
} from '../notifications/web-push-security';
import { SizeGuideImageService } from '../size-guides/size-guide-image.service';
import { SupportAttachmentService } from './support-attachment.service';
import type { SupportNotificationService } from './support-notification.service';
import { SupportService } from './support.service';

// Offline audit evidence only: no Prisma client, Redis client, provider calls,
// environment-file loading or browser automation is used by these checks.
function supportFixture() {
  const readKeys: string[] = [];
  const uploads: string[] = [];
  const messages = [
    { id: 'public', body: 'Public reply', isInternal: false },
    { id: 'internal', body: 'Internal audit note', isInternal: true },
  ];
  const files = [
    { id: 'public-image', ticketId: 'own', workspaceId: 'a', internal: false },
    { id: 'private-image', ticketId: 'own', workspaceId: 'a', internal: true },
    {
      id: 'foreign-image',
      ticketId: 'foreign',
      workspaceId: 'b',
      internal: false,
    },
  ];
  const now = new Date('2026-10-06T12:00:00Z');
  const prisma = {
    workspaceMember: {
      findUnique: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          where.userId === 'member' ? { workspaceId: 'a' } : null,
        ),
    },
    supportTicket: {
      findFirst: ({
        where,
        include,
      }: {
        where: { id: string; workspaceId?: string };
        include: {
          messages: { where?: { isInternal?: boolean } };
          _count: {
            select: { messages: boolean | { where: { isInternal: boolean } } };
          };
        };
      }) => {
        const workspaceId = where.id === 'own' ? 'a' : 'b';
        if (where.workspaceId && where.workspaceId !== workspaceId)
          return Promise.resolve(null);
        const visible = messages.filter(
          (message) =>
            include.messages.where?.isInternal === undefined ||
            message.isInternal === include.messages.where.isInternal,
        );
        const countSelection = include._count.select.messages;
        const counted =
          typeof countSelection === 'boolean'
            ? messages
            : messages.filter(
                (message) =>
                  message.isInternal === countSelection.where.isInternal,
              );
        return Promise.resolve({
          id: where.id,
          workspaceId,
          number: 1,
          createdAt: now,
          messages: visible.map((message) => ({
            ...message,
            createdAt: now,
            author: null,
            attachments: [],
            authorType: 'SUPPORT',
          })),
          _count: { messages: counted.length },
        });
      },
    },
    supportAttachment: {
      findFirst: ({
        where,
      }: {
        where: {
          id: string;
          message: {
            ticketId?: string;
            isInternal?: boolean;
            ticket?: { workspaceId: string };
          };
        };
      }) => {
        const file = files.find(
          (candidate) =>
            candidate.id === where.id &&
            (!where.message.ticketId ||
              candidate.ticketId === where.message.ticketId) &&
            (where.message.isInternal === undefined ||
              candidate.internal === where.message.isInternal) &&
            (!where.message.ticket?.workspaceId ||
              candidate.workspaceId === where.message.ticket.workspaceId),
        );
        return Promise.resolve(
          file ? { objectKey: file.id, contentType: 'image/png' } : null,
        );
      },
    },
  };
  const attachments = {
    read: (key: string) => {
      readKeys.push(key);
      return Promise.resolve(Buffer.from('offline image'));
    },
    upload: () => {
      uploads.push('upload');
      return Promise.resolve([]);
    },
  };
  return {
    readKeys,
    uploads,
    service: new SupportService(
      prisma as unknown as PrismaService,
      {} as SupportNotificationService,
      {} as WorkspacesService,
      attachments as unknown as SupportAttachmentService,
    ),
  };
}

void test('security audit: support images reject foreign tickets, internal notes and missing membership before storage access', async () => {
  const f = supportFixture();
  for (const [ticket, attachment, user] of [
    ['foreign', 'foreign-image', 'member'],
    ['own', 'foreign-image', 'member'],
    ['foreign', 'public-image', 'member'],
    ['own', 'private-image', 'member'],
    ['own', 'public-image', 'removed-member'],
  ]) {
    await assert.rejects(
      f.service.readAttachment(ticket, attachment, user),
      NotFoundException,
    );
  }
  assert.deepEqual(f.readKeys, []);
  const image = await f.service.readAttachment('own', 'public-image', 'member');
  assert.equal(image.contentType, 'image/png');
  assert.deepEqual(f.readKeys, ['public-image']);
});

void test('security audit: a foreign ticket cannot trigger a support upload', async () => {
  const f = supportFixture();
  await assert.rejects(
    f.service.replyWithImages('foreign', 'member', 'hello', []),
    NotFoundException,
  );
  assert.deepEqual(f.uploads, []);
});

void test('audit reproducer: customer detail hides internal content but counts the internal message', async () => {
  const f = supportFixture();
  const detail = await f.service.findOne('own', 'member');
  assert.deepEqual(
    detail.messages.map((message) => message.body),
    ['Public reply'],
  );
  // Known audit finding, not a security acceptance test: the client can infer
  // one hidden message by subtracting the visible message count.
  assert.equal(detail.messageCount, 2);
  assert.equal(detail.messageCount - detail.messages.length, 1);
});

function file(buffer: Buffer, mimetype = 'image/png'): Express.Multer.File {
  return {
    buffer,
    size: buffer.length,
    mimetype,
    originalname: 'image.png',
  } as Express.Multer.File;
}

void test('security audit: upload decoder rejects disguised SVG and corrupt image signatures', async () => {
  const service = new SupportAttachmentService({} as PrismaService);
  for (const bytes of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]),
    Buffer.from([255, 216, 255, 0, 0, 0]),
  ]) {
    await assert.rejects(service.prepare([file(bytes)]), BadRequestException);
  }
});

void test('security audit: valid images are re-encoded and appended active content is discarded', async () => {
  const source = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  const appended = Buffer.from('<script>audit-active-content</script>');
  const service = new SupportAttachmentService({} as PrismaService);
  const [image] = await service.prepare([
    file(Buffer.concat([source, appended]), 'text/html'),
  ]);
  assert.equal(image.contentType, 'image/png');
  assert.equal(image.buffer.includes(appended), false);
  assert.equal((await sharp(image.buffer).metadata()).width, 2);
});

void test('security audit: push endpoint and socket address validation reject private and confusing targets', () => {
  for (const endpoint of [
    'http://fcm.googleapis.com/push',
    'https://fcm.googleapis.com.evil.example/push',
    'https://fcm.googleapis.com@127.0.0.1/push',
    'https://fcm.googleapis.com:8443/push',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]/push',
  ])
    assert.throws(() => validatePushEndpoint(endpoint), BadRequestException);
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
  ])
    assert.equal(isPublicPushAddress(ip), false);
  assert.equal(
    validatePushEndpoint('https://fcm.googleapis.com/push/token').hostname,
    'fcm.googleapis.com',
  );
  assert.equal(isPublicPushAddress('8.8.8.8'), true);
});

void test('security audit: allowlisted admin email still requires verification', () => {
  const admins = new Set(['admin@example.test']);
  assert.equal(
    isConfiguredAdminIdentity(
      { email: 'admin@example.test', emailVerified: false },
      admins,
    ),
    false,
  );
  assert.equal(
    isConfiguredAdminIdentity(
      { email: 'outsider@example.test', emailVerified: true },
      admins,
    ),
    false,
  );
  assert.equal(
    isConfiguredAdminIdentity(
      { email: 'ADMIN@example.test', emailVerified: true },
      admins,
    ),
    true,
  );
});

void test('audit reproducer: size-guide bytes are bounded only after the complete response is consumed', async () => {
  const previousHosts = process.env.SIZE_GUIDE_ALLOWED_HOSTS;
  const previousLimit = process.env.SIZE_GUIDE_MAX_IMAGE_BYTES;
  const originalFetch = globalThis.fetch;
  let received = 0;
  process.env.SIZE_GUIDE_ALLOWED_HOSTS = 'cdn.dsmcdn.com';
  process.env.SIZE_GUIDE_MAX_IMAGE_BYTES = '100000';
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (received >= 400000) return controller.close();
            received += 50000;
            controller.enqueue(new Uint8Array(50000));
          },
        }),
        { headers: { 'content-type': 'image/png' } },
      ),
    );
  try {
    const service = new SizeGuideImageService();
    await assert.rejects(
      service.download('https://cdn.dsmcdn.com/offline-audit.png'),
      /boyutu geçersiz/,
    );
    // The synthetic provider sent four times the allowed amount; every byte
    // was consumed before rejection. No real CDN connection is made.
    assert.equal(received, 400000);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousHosts === undefined)
      delete process.env.SIZE_GUIDE_ALLOWED_HOSTS;
    else process.env.SIZE_GUIDE_ALLOWED_HOSTS = previousHosts;
    if (previousLimit === undefined)
      delete process.env.SIZE_GUIDE_MAX_IMAGE_BYTES;
    else process.env.SIZE_GUIDE_MAX_IMAGE_BYTES = previousLimit;
  }
});
