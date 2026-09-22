import { createHmac } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

const RATE_WINDOW_MS = 60 * 60 * 1_000;
const MAX_REQUESTS_PER_FINGERPRINT = 5;
const MAX_REQUESTS_PER_EMAIL = 3;

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateContactMessageDto, ipAddress: string) {
    if (input.website?.trim()) return { accepted: true };

    const emailNormalized = input.email.trim().toLocaleLowerCase('en-US');
    const requestFingerprint = contactFingerprint(ipAddress);
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
    const [fingerprintRequests, emailRequests] = await Promise.all([
      this.prisma.contactMessage.count({
        where: {
          requestFingerprint,
          createdAt: { gte: windowStart },
        },
      }),
      this.prisma.contactMessage.count({
        where: {
          emailNormalized,
          createdAt: { gte: windowStart },
        },
      }),
    ]);

    if (
      fingerprintRequests >= MAX_REQUESTS_PER_FINGERPRINT ||
      emailRequests >= MAX_REQUESTS_PER_EMAIL
    ) {
      throw new HttpException(
        {
          code: 'CONTACT_RATE_LIMITED',
          message:
            'Kısa süre içinde çok sayıda mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.',
          retryAfterSeconds: Math.ceil(RATE_WINDOW_MS / 1_000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        emailNormalized,
        company: input.company || null,
        topic: input.topic,
        subject: input.subject,
        message: input.message,
        sourcePage: normalizeSourcePage(input.sourcePage),
        requestFingerprint,
      },
      select: { id: true },
    });

    return { accepted: true };
  }
}

function contactFingerprint(ipAddress: string) {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    'core-asistan-contact-development-only';
  return createHmac('sha256', secret)
    .update(ipAddress.trim() || 'unknown')
    .digest('hex');
}

function normalizeSourcePage(value: string | undefined) {
  if (!value?.startsWith('/')) return null;
  return value.slice(0, 200);
}
