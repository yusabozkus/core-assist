import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma, SupportImageObject } from '../../generated/prisma/client';
import { SupportImageObjectState } from '../../generated/prisma/enums';
import { SupportAttachmentService } from './support-attachment.service';

const config = {
  endpoint: 'https://s3.eu-central-003.backblazeb2.com',
  region: 'eu-central-003',
  bucket: 'unit-test-only',
  accessKeyId: 'test-key',
  secretAccessKey: 'not-a-real-secret',
};
const now = new Date('2026-10-06T12:00:00Z');

function fixture() {
  // Storage uses only the mock client below, never the real B2 endpoint.
  process.env.SUPPORT_B2_ENDPOINT = config.endpoint;
  process.env.SUPPORT_B2_REGION = config.region;
  process.env.SUPPORT_B2_BUCKET = config.bucket;
  process.env.SUPPORT_B2_KEY_ID = config.accessKeyId;
  process.env.SUPPORT_B2_APPLICATION_KEY = config.secretAccessKey;
  const objects = new Map<string, SupportImageObject>();
  const attachments = new Set<string>();
  const puts: string[] = [];
  const deletes: string[] = [];
  const lists: string[] = [];
  const versions = new Map<
    string,
    { Key: string; VersionId: string; marker?: boolean }[]
  >();
  const failures = {
    reserve: false,
    putAt: 0,
    delete: false,
    dbDelete: false,
    discard: false,
  };
  const matches = (
    row: SupportImageObject,
    where: Prisma.SupportImageObjectWhereInput,
  ) => {
    if (
      typeof where.objectKey === 'string' &&
      row.objectKey !== where.objectKey
    )
      return false;
    if (
      where.objectKey &&
      typeof where.objectKey === 'object' &&
      where.objectKey.in &&
      !(where.objectKey.in as string[]).includes(row.objectKey)
    )
      return false;
    if (typeof where.state === 'string' && row.state !== where.state)
      return false;
    if (
      where.state &&
      typeof where.state === 'object' &&
      where.state.in &&
      !(where.state.in as string[]).includes(row.state)
    )
      return false;
    if (
      where.deleteAfter &&
      typeof where.deleteAfter === 'object' &&
      'lte' in where.deleteAfter &&
      (!row.deleteAfter || row.deleteAfter > (where.deleteAfter.lte as Date))
    )
      return false;
    if (
      where.OR &&
      !where.OR.some((condition) => {
        if (condition.claimUntil === null) return row.claimUntil === null;
        const filter = condition.claimUntil;
        return (
          filter &&
          typeof filter === 'object' &&
          'lte' in filter &&
          row.claimUntil !== null &&
          row.claimUntil <= (filter.lte as Date)
        );
      })
    )
      return false;
    if (
      typeof where.claimToken === 'string' &&
      row.claimToken !== where.claimToken
    )
      return false;
    if (where.attachment === null && attachments.has(row.objectKey))
      return false;
    return true;
  };
  const object = (key: string, patch: Partial<SupportImageObject> = {}) => {
    const row: SupportImageObject = {
      objectKey: key,
      state: SupportImageObjectState.PENDING_DELETE,
      storageEndpoint: config.endpoint,
      storageRegion: config.region,
      storageBucket: config.bucket,
      deleteAfter: new Date(now.getTime() - 1),
      attemptCount: 0,
      lastError: null,
      claimToken: null,
      claimUntil: null,
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    objects.set(key, row);
    versions.set(key, [{ Key: key, VersionId: 'test-version' }]);
    return row;
  };
  const prisma = {
    supportImageObject: {
      createMany: ({
        data,
      }: {
        data: Prisma.SupportImageObjectCreateManyInput[];
      }) => {
        if (failures.reserve)
          return Promise.reject(new Error('Database unavailable'));
        for (const row of data) {
          object(row.objectKey, row as Partial<SupportImageObject>);
          versions.delete(row.objectKey);
        }
        return Promise.resolve({ count: data.length });
      },
      findMany: ({ where }: { where: Prisma.SupportImageObjectWhereInput }) =>
        Promise.resolve(
          [...objects.values()]
            .filter((row) => matches(row, where))
            .map((row) => ({ ...row })),
        ),
      findUnique: ({ where }: { where: { objectKey: string } }) =>
        Promise.resolve(objects.get(where.objectKey)),
      updateMany: ({
        where,
        data,
      }: {
        where: Prisma.SupportImageObjectWhereInput;
        data: Prisma.SupportImageObjectUpdateManyMutationInput;
      }) => {
        if (
          failures.discard &&
          !data.claimToken &&
          data.state === 'PENDING_DELETE'
        )
          return Promise.reject(new Error('Database unavailable'));
        let count = 0;
        for (const row of objects.values()) {
          if (!matches(row, where)) continue;
          const attemptCount =
            row.attemptCount +
            (typeof data.attemptCount === 'object'
              ? (data.attemptCount.increment ?? 0)
              : 0);
          Object.assign(row, data, { attemptCount });
          count++;
        }
        return Promise.resolve({ count });
      },
      deleteMany: ({
        where,
      }: {
        where: Prisma.SupportImageObjectWhereInput;
      }) => {
        if (failures.dbDelete)
          return Promise.reject(
            new Error('Database unavailable after B2 delete'),
          );
        let count = 0;
        for (const [key, row] of objects)
          if (matches(row, where)) {
            objects.delete(key);
            count++;
          }
        return Promise.resolve({ count });
      },
    },
  };
  const service = new SupportAttachmentService(
    prisma as unknown as PrismaService,
  );
  const mockClient = {
    destroy: () => undefined,
    send: (
      command:
        PutObjectCommand | DeleteObjectCommand | ListObjectVersionsCommand,
    ) => {
      if (command instanceof ListObjectVersionsCommand) {
        const prefix = command.input.Prefix!;
        lists.push(prefix);
        const listed = [...versions.values()]
          .flat()
          .filter((version) => version.Key.startsWith(prefix));
        const page = listed.slice(0, command.input.MaxKeys);
        return Promise.resolve({
          Versions: page.filter((version) => !version.marker),
          DeleteMarkers: page.filter((version) => version.marker),
        });
      }
      const key = command.input.Key!;
      if (command instanceof PutObjectCommand) {
        assert.ok(objects.has(key), 'the key must be durable before PUT');
        puts.push(key);
        versions.set(key, [
          ...(versions.get(key) ?? []),
          { Key: key, VersionId: `put-${puts.length}` },
        ]);
        if (failures.putAt === puts.length)
          return Promise.reject(new Error('PUT response lost'));
      } else if (command instanceof DeleteObjectCommand) {
        deletes.push(key);
        if (failures.delete) return Promise.reject(new Error('B2 unavailable'));
        assert.ok(
          command.input.VersionId,
          'must delete an explicit B2 version',
        );
        versions.set(
          key,
          (versions.get(key) ?? []).filter(
            (version) => version.VersionId !== command.input.VersionId,
          ),
        );
      } else throw new Error('Unexpected storage request');
      return Promise.resolve({});
    },
  };
  const internals = service as unknown as {
    client: S3Client;
    clientConfig: string;
  };
  internals.client = mockClient as unknown as S3Client;
  internals.clientConfig = JSON.stringify(config);
  service.prepare = () =>
    Promise.resolve(
      [0, 1, 2].map(() => ({
        buffer: Buffer.from('test'),
        contentType: 'image/png' as const,
        size: 4,
      })),
    );
  return {
    service,
    object,
    objects,
    attachments,
    puts,
    deletes,
    lists,
    versions,
    failures,
  };
}

void test('reserves all keys and storage targets before uploading any image', async () => {
  const f = fixture();
  const images = await f.service.upload([]);
  assert.equal(images.length, 3);
  assert.equal(f.puts.length, 3);
  for (const image of images) {
    const row = f.objects.get(image.objectKey)!;
    assert.equal(row.state, 'STAGED');
    assert.equal(row.storageBucket, config.bucket);
    assert.equal(row.storageEndpoint, config.endpoint);
    assert.ok(row.deleteAfter!.getTime() > Date.now());
  }
});

void test('does not write to B2 if durable reservation fails', async () => {
  const f = fixture();
  f.failures.reserve = true;
  await assert.rejects(f.service.upload([]), /Database unavailable/);
  assert.equal(f.puts.length, 0);
});

void test('partial upload failure retains cleanup for successful and ambiguous writes', async () => {
  const f = fixture();
  f.failures.putAt = 2;
  await assert.rejects(f.service.upload([]), /PUT response lost/);
  assert.equal(f.objects.size, 3);
  for (const row of f.objects.values()) {
    assert.equal(row.state, 'PENDING_DELETE');
    assert.ok(row.deleteAfter!.getTime() >= Date.now() + 4 * 60_000);
  }
  assert.equal(
    f.deletes.length,
    0,
    'let in-flight PUTs settle before deletion',
  );
});

void test('a failed cleanup hint preserves the upload error and the expiring reservation', async () => {
  const f = fixture();
  f.failures.putAt = 1;
  f.failures.discard = true;
  await assert.rejects(f.service.upload([]), /PUT response lost/);
  assert.equal(f.objects.size, 3);
  assert.ok(
    [...f.objects.values()].every(
      (row) => row.state === 'STAGED' && row.deleteAfter,
    ),
  );
});

void test('post-commit reply failure does not delete already attached images', async () => {
  const f = fixture();
  f.object('support/saved', { state: 'ATTACHED', deleteAfter: null });
  f.attachments.add('support/saved');
  await f.service.discardUnattached([
    { objectKey: 'support/saved', size: 1, contentType: 'image/png' },
  ]);
  assert.equal(f.objects.get('support/saved')!.state, 'ATTACHED');
  assert.equal(f.deletes.length, 0);
});

void test('sweeps expired uploads while preserving attached images, fresh uploads and active claims', async () => {
  const f = fixture();
  f.object('support/expired-upload', { state: 'STAGED' });
  f.object('support/deleted-ticket');
  f.object('support/saved', { state: 'ATTACHED', deleteAfter: null });
  f.attachments.add('support/saved');
  f.object('support/fresh-upload', {
    state: 'STAGED',
    deleteAfter: new Date(now.getTime() + 60_000),
  });
  f.object('support/claimed', {
    claimToken: 'another-worker',
    claimUntil: new Date(now.getTime() + 60_000),
  });
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 2,
    retry: 0,
  });
  assert.deepEqual(f.deletes.sort(), [
    'support/deleted-ticket',
    'support/expired-upload',
  ]);
  assert.equal(f.objects.size, 3);
});

void test('B2 failure keeps the key for a later successful retry', async () => {
  const f = fixture();
  f.object('support/retry');
  f.failures.delete = true;
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 0,
    retry: 1,
  });
  const row = f.objects.get('support/retry')!;
  assert.equal(row.attemptCount, 1);
  assert.equal(row.claimToken, null);
  assert.equal(row.claimUntil, null);
  assert.equal(row.lastError, 'Error');
  assert.equal(row.deleteAfter!.getTime(), now.getTime() + 60_000);
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 0,
    retry: 0,
  });
  f.failures.delete = false;
  assert.deepEqual(await f.service.cleanupPendingObjects(row.deleteAfter!), {
    deleted: 1,
    retry: 0,
  });
  assert.equal(f.objects.size, 0);
});

void test('a DB failure after B2 deletion is recovered through the expired claim', async () => {
  const f = fixture();
  f.object('support/retry-delete');
  f.failures.dbDelete = true;
  await assert.rejects(
    f.service.cleanupPendingObjects(now),
    /Database unavailable after B2 delete/,
  );
  assert.equal(f.objects.size, 1);
  assert.ok(f.objects.get('support/retry-delete')!.claimUntil);
  f.failures.dbDelete = false;
  assert.deepEqual(
    await f.service.cleanupPendingObjects(new Date(now.getTime() + 3 * 60_000)),
    { deleted: 1, retry: 0 },
  );
  assert.equal(f.deletes.length, 1);
  assert.equal(
    f.lists.length,
    3,
    'retry confirms the object is already absent',
  );
});

void test('concurrent sweeps cannot both own an active cleanup claim', async () => {
  const f = fixture();
  f.object('support/concurrent');
  const results = await Promise.all([
    f.service.cleanupPendingObjects(now),
    f.service.cleanupPendingObjects(now),
  ]);
  assert.equal(
    results.reduce((sum, result) => sum + result.deleted, 0),
    1,
  );
  assert.equal(f.deletes.length, 1);
});

void test('a changed bucket configuration does not delete from the wrong bucket', async () => {
  const f = fixture();
  f.object('support/old-bucket', { storageBucket: 'previous-bucket' });
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 0,
    retry: 1,
  });
  assert.equal(f.deletes.length, 0);
  assert.equal(f.objects.size, 1);
});

void test('purges all B2 versions and delete markers without touching neighboring keys', async () => {
  const f = fixture();
  f.object('support/versions');
  f.versions.set('support/versions', [
    { Key: 'support/versions', VersionId: 'latest' },
    { Key: 'support/versions', VersionId: 'older' },
    { Key: 'support/versions', VersionId: 'delete-marker', marker: true },
  ]);
  f.versions.set('support/versions-neighbor', [
    { Key: 'support/versions-neighbor', VersionId: 'keep' },
  ]);
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 1,
    retry: 0,
  });
  assert.equal(f.deletes.length, 3);
  assert.ok(f.deletes.every((key) => key === 'support/versions'));
  assert.equal(f.versions.get('support/versions')!.length, 0);
  assert.equal(f.versions.get('support/versions-neighbor')!.length, 1);
});

void test('continues version cleanup after a full first page', async () => {
  const f = fixture();
  f.object('support/many-versions');
  f.versions.set(
    'support/many-versions',
    Array.from({ length: 105 }, (_, i) => ({
      Key: 'support/many-versions',
      VersionId: `v-${i}`,
    })),
  );
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 1,
    retry: 0,
  });
  assert.equal(f.deletes.length, 105);
  assert.equal(f.lists.length, 3);
});

void test('an absent object is safely acknowledged without creating a new delete marker', async () => {
  const f = fixture();
  f.object('support/absent');
  f.versions.delete('support/absent');
  assert.deepEqual(await f.service.cleanupPendingObjects(now), {
    deleted: 1,
    retry: 0,
  });
  assert.equal(f.deletes.length, 0);
  assert.equal(f.objects.size, 0);
});
