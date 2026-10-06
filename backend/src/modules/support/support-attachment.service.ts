import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma, SupportImageObject } from '../../generated/prisma/client';
import { SupportImageObjectState } from '../../generated/prisma/enums';

export const MAX_SUPPORT_IMAGES = 3;
export const MAX_SUPPORT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_WORKSPACE_IMAGE_BYTES = 512 * 1024 * 1024;
const MAX_SUPPORT_IMAGE_PIXELS = 16_000_000;
const MAX_SUPPORT_IMAGE_SIDE = 4096;
const UPLOAD_EXPIRY_MS = 60 * 60 * 1000;
const FAILED_UPLOAD_GRACE_MS = 5 * 60 * 1000;
const STORAGE_REQUEST_TIMEOUT_MS = 30_000;
const CLEANUP_CLAIM_MS = 2 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 20;

const imageFormats = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
} as const;

export type StoredSupportImage = {
  objectKey: string;
  contentType: string;
  size: number;
};

export function assertSupportImageQuota(
  usedBytes: number,
  images: StoredSupportImage[],
) {
  if (
    usedBytes + images.reduce((sum, image) => sum + image.size, 0) >
    MAX_SUPPORT_WORKSPACE_IMAGE_BYTES
  ) {
    throw new BadRequestException(
      'Bu müşteri hesabının destek görseli depolama sınırına ulaşıldı.',
    );
  }
}

@Injectable()
export class SupportAttachmentService implements OnModuleDestroy {
  private readonly logger = new Logger(SupportAttachmentService.name);
  private client: S3Client | null = null;
  private clientConfig: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    this.client?.destroy();
  }

  private config() {
    const endpointValue = process.env.SUPPORT_B2_ENDPOINT;
    const region = process.env.SUPPORT_B2_REGION;
    const bucket = process.env.SUPPORT_B2_BUCKET;
    const accessKeyId = process.env.SUPPORT_B2_KEY_ID;
    const secretAccessKey = process.env.SUPPORT_B2_APPLICATION_KEY;
    if (
      !endpointValue ||
      !region ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      throw new ServiceUnavailableException(
        'Görsel depolama yapılandırılmamış.',
      );
    }
    const endpoint = normalizeB2Endpoint(endpointValue, region);
    return { endpoint, region, bucket, accessKeyId, secretAccessKey };
  }

  private storage(target?: SupportImageObject) {
    const config = this.config();
    if (
      target &&
      ((target.storageEndpoint && target.storageEndpoint !== config.endpoint) ||
        (target.storageRegion && target.storageRegion !== config.region) ||
        (target.storageBucket && target.storageBucket !== config.bucket))
    ) {
      throw new ServiceUnavailableException(
        'Görselin kayıtlı B2 konumu mevcut yapılandırmayla eşleşmiyor.',
      );
    }
    // Config may change during tests or key rotation. Never reuse a client
    // with a different endpoint/credential pair. This value is never logged.
    const clientConfig = JSON.stringify(config);
    if (!this.client || this.clientConfig !== clientConfig) {
      this.client?.destroy();
      this.client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true,
        maxAttempts: 2,
        requestChecksumCalculation: 'WHEN_REQUIRED',
      });
      this.clientConfig = clientConfig;
    }
    return { client: this.client, ...config };
  }

  validate(files: Express.Multer.File[] | undefined) {
    if (!files?.length || files.length > MAX_SUPPORT_IMAGES) {
      throw new BadRequestException('Bir mesajda 1-3 görsel seçin.');
    }
    return files.map((file) => {
      if (!file.buffer?.length || file.size > MAX_SUPPORT_IMAGE_BYTES) {
        throw new BadRequestException('Her görsel en fazla 5 MB olabilir.');
      }
      const contentType = detectImageType(file.buffer);
      if (!contentType) {
        throw new BadRequestException(
          'Yalnızca PNG, JPEG veya WebP görselleri yükleyin.',
        );
      }
      return { buffer: file.buffer, contentType, size: file.size };
    });
  }

  async prepare(files: Express.Multer.File[] | undefined) {
    const images = this.validate(files);
    const prepared: ReturnType<typeof this.validate> = [];
    for (const image of images) {
      try {
        const decoder = sharp(image.buffer, {
          autoOrient: true,
          failOn: 'warning',
          limitInputPixels: MAX_SUPPORT_IMAGE_PIXELS,
        });
        const metadata = await decoder.metadata();
        if (
          !metadata.width ||
          !metadata.height ||
          metadata.width * metadata.height > MAX_SUPPORT_IMAGE_PIXELS ||
          (metadata.pages ?? 1) !== 1 ||
          metadata.format !== imageFormats[image.contentType]
        ) {
          throw new BadRequestException(
            'Görsel biçimi veya boyutları geçersiz.',
          );
        }

        const output = await decoder
          .resize({
            width: MAX_SUPPORT_IMAGE_SIDE,
            height: MAX_SUPPORT_IMAGE_SIDE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFormat(imageFormats[image.contentType])
          .toBuffer();
        if (!output.length || output.length > MAX_SUPPORT_IMAGE_BYTES) {
          throw new BadRequestException(
            'İşlenen görsel en fazla 5 MB olabilir.',
          );
        }
        prepared.push({
          buffer: output,
          contentType: image.contentType,
          size: output.length,
        });
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(
          'Görsel okunamadı. Geçerli bir PNG, JPEG veya WebP seçin.',
        );
      }
    }
    return prepared;
  }

  async upload(files: Express.Multer.File[] | undefined) {
    const images = await this.prepare(files);
    const { client, bucket, endpoint, region } = this.storage();
    const staged = images.map((image) => ({
      objectKey: `support/${randomUUID()}`,
      contentType: image.contentType,
      size: image.size,
    }));
    // Reserve every key BEFORE any network write, including writes whose
    // response is lost. A crashed request leaves recoverable cleanup work.
    await this.prisma.supportImageObject.createMany({
      data: staged.map((image) => ({
        objectKey: image.objectKey,
        state: SupportImageObjectState.STAGED,
        storageEndpoint: endpoint,
        storageRegion: region,
        storageBucket: bucket,
        deleteAfter: new Date(Date.now() + UPLOAD_EXPIRY_MS),
      })),
    });
    try {
      for (const [index, image] of images.entries()) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: staged[index].objectKey,
            Body: image.buffer,
            ContentType: image.contentType,
            ContentLength: image.size,
          }),
          { abortSignal: AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS) },
        );
      }
      return staged;
    } catch (error) {
      await this.discardUnattached(staged);
      throw error;
    }
  }

  async read(objectKey: string) {
    const imageObject = await this.prisma.supportImageObject.findUnique({
      where: { objectKey },
    });
    if (!imageObject || imageObject.state !== SupportImageObjectState.ATTACHED)
      throw new ServiceUnavailableException('Görsel okunamadı.');
    const { client, bucket } = this.storage(imageObject);
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { abortSignal: AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS) },
    );
    if (!result.Body)
      throw new ServiceUnavailableException('Görsel okunamadı.');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async discardUnattached(images: StoredSupportImage[]) {
    if (!images.length) return;
    try {
      await this.prisma.supportImageObject.updateMany({
        where: {
          objectKey: { in: images.map((image) => image.objectKey) },
          state: SupportImageObjectState.STAGED,
          attachment: null,
        },
        data: {
          state: SupportImageObjectState.PENDING_DELETE,
          // An aborted PUT may have reached B2. Let in-flight writes settle.
          deleteAfter: new Date(Date.now() + FAILED_UPLOAD_GRACE_MS),
        },
      });
    } catch {
      // Preserve the original upload/reply error. The pre-upload reservation
      // still expires and will be swept even if this early cleanup hint fails.
      this.logger.error('Could not expedite staged support image cleanup.');
    }
  }

  async cleanupPendingObjects(now = new Date()) {
    const due = {
      state: {
        in: [
          SupportImageObjectState.STAGED,
          SupportImageObjectState.PENDING_DELETE,
        ],
      },
      deleteAfter: { lte: now },
      OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      attachment: null,
    } satisfies Prisma.SupportImageObjectWhereInput;
    const records = await this.prisma.supportImageObject.findMany({
      where: due,
      orderBy: [{ deleteAfter: 'asc' }, { objectKey: 'asc' }],
      take: CLEANUP_BATCH_SIZE,
    });
    const outcomes = await Promise.allSettled(
      records.map(async (record) => {
        const claimToken = randomUUID();
        const claimed = await this.prisma.supportImageObject.updateMany({
          where: { ...due, objectKey: record.objectKey },
          data: {
            state: SupportImageObjectState.PENDING_DELETE,
            claimToken,
            claimUntil: new Date(now.getTime() + CLEANUP_CLAIM_MS),
            attemptCount: { increment: 1 },
          },
        });
        if (!claimed.count) return 'skipped';

        const ownedClaim = { objectKey: record.objectKey, claimToken };
        try {
          const { client, bucket } = this.storage(record);
          await this.purgeObjectVersions(client, bucket, record.objectKey);
        } catch (error) {
          const attempt = record.attemptCount + 1;
          const errorCode =
            error instanceof Error
              ? error.name.slice(0, 80)
              : 'StorageCleanupFailed';
          await this.prisma.supportImageObject.updateMany({
            where: ownedClaim,
            data: {
              claimToken: null,
              claimUntil: null,
              lastError: errorCode,
              deleteAfter: new Date(
                now.getTime() + cleanupRetryDelayMs(attempt),
              ),
            },
          });
          this.logger.warn({
            message: 'Support image cleanup will be retried.',
            objectKey: record.objectKey,
            attempt,
            errorCode,
          });
          return 'retry';
        }
        // If this DB write fails after B2 succeeded, the lease expires and the
        // next worker repeats the idempotent delete instead of losing the job.
        const deleted = await this.prisma.supportImageObject.deleteMany({
          where: ownedClaim,
        });
        return deleted.count ? 'deleted' : 'skipped';
      }),
    );
    const failure = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    return {
      deleted: outcomes.filter(
        (outcome) =>
          outcome.status === 'fulfilled' && outcome.value === 'deleted',
      ).length,
      retry: outcomes.filter(
        (outcome) =>
          outcome.status === 'fulfilled' && outcome.value === 'retry',
      ).length,
    };
  }
  private async purgeObjectVersions(
    client: S3Client,
    bucket: string,
    objectKey: string,
  ) {
    const abortSignal = AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS);
    // B2 is versioned. Deleting only the current key can retain older data.
    // Re-read the first page after deletion instead of using a deleted version
    // as a pagination cursor. Bound each run; unfinished work stays retryable.
    for (let page = 0; page < 5; page++) {
      const result = await client.send(
        new ListObjectVersionsCommand({
          Bucket: bucket,
          Prefix: objectKey,
          MaxKeys: 100,
        }),
        { abortSignal },
      );
      const versions = [
        ...(result.Versions ?? []),
        ...(result.DeleteMarkers ?? []),
      ].filter((version) => version.Key === objectKey);
      if (!versions.length) return;
      for (const version of versions) {
        if (!version.VersionId) throw new Error('SupportImageVersionIdMissing');
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            VersionId: version.VersionId,
          }),
          { abortSignal },
        );
      }
    }
    throw new Error('SupportImageCleanupIncomplete');
  }
}

function cleanupRetryDelayMs(attempt: number) {
  return Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** Math.min(attempt - 1, 10));
}

export function normalizeB2Endpoint(value: string, region: string) {
  const input = value.trim();
  const endpoint = input.includes('://') ? input : `https://${input}`;
  try {
    const url = new URL(endpoint);
    if (
      url.protocol === 'https:' &&
      url.hostname === `s3.${region}.backblazeb2.com` &&
      url.pathname === '/' &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    ) {
      return url.origin;
    }
  } catch {
    // Handled by the configuration error below.
  }
  throw new ServiceUnavailableException(
    'B2 endpoint ve region ayarları eşleşmiyor veya endpoint geçersiz.',
  );
}

function detectImageType(buffer: Buffer): keyof typeof imageFormats | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return 'image/jpeg';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
