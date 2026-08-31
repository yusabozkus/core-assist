import { Injectable } from '@nestjs/common';
import { DEFAULT_SIZE_GUIDE_MAX_IMAGE_BYTES } from './size-guide.constants';

const DEFAULT_ALLOWED_HOSTS = [
  'cdn.dsmcdn.com',
  'productimages.hepsiburada.net',
];
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class SizeGuideImageService {
  private readonly allowedHosts = parseAllowedHosts(
    process.env.SIZE_GUIDE_ALLOWED_HOSTS,
  );
  private readonly maxBytes = parseMaxBytes(
    process.env.SIZE_GUIDE_MAX_IMAGE_BYTES,
  );

  async download(sourceUrl: string) {
    let url = new URL(sourceUrl);

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      this.assertAllowedUrl(url);
      const response = await fetch(url, {
        headers: { Accept: 'image/jpeg,image/png,image/webp' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === 3) {
          throw new Error(
            'Beden tablosu görseli güvenli biçimde yönlendirilemedi.',
          );
        }
        url = new URL(location, url);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Beden tablosu görseli indirilemedi (${response.status}).`,
        );
      }

      const mimeType = normalizeMimeType(response.headers.get('content-type'));
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error(
          `Desteklenmeyen beden tablosu görsel türü: ${mimeType}.`,
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > this.maxBytes) {
        throw new Error('Beden tablosu görseli izin verilen boyutu aşıyor.');
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > this.maxBytes) {
        throw new Error('Beden tablosu görsel boyutu geçersiz.');
      }

      return { bytes, mimeType, finalUrl: url.toString() };
    }

    throw new Error('Beden tablosu görseli indirilemedi.');
  }

  private assertAllowedUrl(url: URL) {
    if (url.protocol !== 'https:') {
      throw new Error('Beden tablosu görseli HTTPS üzerinden sunulmalıdır.');
    }

    const hostname = url.hostname.toLocaleLowerCase('en-US');
    const allowed = this.allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    if (!allowed) {
      throw new Error(
        `Beden tablosu görsel alan adına izin verilmiyor: ${hostname}.`,
      );
    }
  }
}

function parseAllowedHosts(value: string | undefined) {
  const configured = value
    ?.split(',')
    .map((host) => host.trim().toLocaleLowerCase('en-US'))
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ALLOWED_HOSTS;
}

function parseMaxBytes(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 100_000 && parsed <= 20_000_000
    ? Math.trunc(parsed)
    : DEFAULT_SIZE_GUIDE_MAX_IMAGE_BYTES;
}

function normalizeMimeType(value: string | null) {
  return value?.split(';')[0]?.trim().toLocaleLowerCase('en-US') ?? '';
}
