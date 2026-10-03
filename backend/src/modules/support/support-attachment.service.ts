import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const MAX_SUPPORT_IMAGES = 3;
export const MAX_SUPPORT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_WORKSPACE_IMAGE_BYTES = 512 * 1024 * 1024;
const MAX_SUPPORT_IMAGE_PIXELS = 16_000_000;
const MAX_SUPPORT_IMAGE_SIDE = 4096;

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
export class SupportAttachmentService {
  private readonly logger = new Logger(SupportAttachmentService.name);
  private client: S3Client | null = null;

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

  private storage() {
    const config = this.config();
    this.client ??= new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    return { client: this.client, bucket: config.bucket };
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
    const { client, bucket } = this.storage();
    const uploaded: StoredSupportImage[] = [];
    try {
      for (const image of images) {
        const objectKey = `support/${randomUUID()}`;
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: image.buffer,
            ContentType: image.contentType,
            ContentLength: image.size,
          }),
        );
        uploaded.push({
          objectKey,
          contentType: image.contentType,
          size: image.size,
        });
      }
      return uploaded;
    } catch (error) {
      await this.remove(uploaded);
      throw error;
    }
  }

  async read(objectKey: string) {
    const { client, bucket } = this.storage();
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
    if (!result.Body)
      throw new ServiceUnavailableException('Görsel okunamadı.');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async remove(images: StoredSupportImage[]) {
    if (!images.length) return;
    const { client, bucket } = this.storage();
    await Promise.all(
      images.map(async (image) => {
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: image.objectKey }),
          );
        } catch (error) {
          this.logger.error(
            `Destek görseli silinemedi: ${image.objectKey}`,
            error,
          );
        }
      }),
    );
  }

  async removeStrict(objectKeys: string[]) {
    if (!objectKeys.length) return;
    const { client, bucket } = this.storage();
    for (const objectKey of objectKeys) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
    }
  }
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
