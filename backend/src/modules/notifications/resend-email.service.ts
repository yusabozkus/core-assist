import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  EmailDeliveryStatus,
  WorkspaceInvitationStatus,
} from '../../generated/prisma/enums';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';

const CLAIM_MS = 2 * 60_000;
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60_000;
const RETENTION_MS = 90 * 24 * 60 * 60_000;

export type EmailSendResult = 'SENT' | 'DEFERRED' | 'FAILED';

export type EmailRequest = {
  deliveryKey: string;
  recipientUserId: string | null;
  storeId: string | null;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  html: string;
  sensitive?: boolean;
};

class ResendRequestError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY?.trim() || null;
  private encryption: CredentialsEncryptionService | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get configured() {
    return Boolean(this.apiKey);
  }

  async send(input: EmailRequest): Promise<EmailSendResult> {
    if (!this.configured) return 'DEFERRED';
    const record = await this.stage(input, this.prisma);
    return this.process(record.id);
  }

  async stage(
    input: EmailRequest,
    transaction: Pick<Prisma.TransactionClient, 'emailDeliveryRecord'>,
  ) {
    if (!input.deliveryKey || input.deliveryKey.length > 256)
      throw new Error('Invalid email delivery key.');
    const { sensitive, ...data } = input;
    return transaction.emailDeliveryRecord.upsert({
      where: { deliveryKey: input.deliveryKey },
      create: {
        ...data,
        html: sensitive ? this.encryptHtml(input.html) : input.html,
      },
      update: {},
      select: { id: true },
    });
  }

  async deliverStaged(deliveryKey: string): Promise<EmailSendResult> {
    if (!this.configured) return 'DEFERRED';
    const record = await this.prisma.emailDeliveryRecord.findUnique({
      where: { deliveryKey },
      select: { id: true },
    });
    if (!record) return 'FAILED';
    return this.process(record.id);
  }

  async cancelPendingInvitation(
    transaction: Pick<Prisma.TransactionClient, 'emailDeliveryRecord'>,
    invitationId: string,
  ) {
    await transaction.emailDeliveryRecord.updateMany({
      where: {
        deliveryKey: { startsWith: `team-invite:${invitationId}:` },
        status: EmailDeliveryStatus.PENDING,
      },
      data: {
        status: EmailDeliveryStatus.FAILED,
        html: null,
        lastErrorCode: 'INVITATION_INVALIDATED',
        lastErrorMessage: 'Davet bağlantısı değişti veya kullanılamıyor.',
      },
    });
  }

  async sweepDue() {
    if (!this.configured) return;
    const now = new Date();
    let cursor: string | undefined;
    let failures = 0;
    while (true) {
      const records = await this.prisma.emailDeliveryRecord.findMany({
        where: {
          status: EmailDeliveryStatus.PENDING,
          nextAttemptAt: { lte: now },
          OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 100,
        select: { id: true },
      });
      if (records.length === 0) break;
      for (const record of records) {
        try {
          await this.process(record.id);
        } catch (error) {
          failures += 1;
          this.logger.warn(
            `E-posta teslimat kaydı işlenemedi (${record.id}): ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          );
        }
      }
      cursor = records[records.length - 1].id;
    }

    await this.prisma.emailDeliveryRecord.deleteMany({
      where: {
        status: {
          in: [
            EmailDeliveryStatus.SENT,
            EmailDeliveryStatus.FAILED,
            EmailDeliveryStatus.REVIEW_REQUIRED,
          ],
        },
        updatedAt: { lte: new Date(now.getTime() - RETENTION_MS) },
      },
    });
    if (failures)
      throw new Error(`${failures} e-posta kaydı yeniden denenecek.`);
  }

  private async process(id: string): Promise<EmailSendResult> {
    if (!this.configured) return 'DEFERRED';
    const record = await this.prisma.emailDeliveryRecord.findUnique({
      where: { id },
    });
    if (!record) return 'FAILED';
    if (record.status === EmailDeliveryStatus.SENT) return 'SENT';
    if (record.status !== EmailDeliveryStatus.PENDING) return 'FAILED';

    const now = new Date();
    if (record.nextAttemptAt > now) return 'DEFERRED';
    const token = randomUUID();
    const claim = await this.prisma.emailDeliveryRecord.updateMany({
      where: {
        id,
        status: EmailDeliveryStatus.PENDING,
        OR: [{ claimUntil: null }, { claimUntil: { lte: now } }],
      },
      data: {
        claimToken: token,
        claimUntil: new Date(now.getTime() + CLAIM_MS),
      },
    });
    if (!claim.count) return 'DEFERRED';

    try {
      if (
        record.firstAttemptAt &&
        now.getTime() - record.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS
      ) {
        await this.prisma.emailDeliveryRecord.updateMany({
          where: { id, claimToken: token },
          data: {
            status: EmailDeliveryStatus.REVIEW_REQUIRED,
            html: null,
            lastErrorCode: 'IDEMPOTENCY_WINDOW_EXPIRED',
            lastErrorMessage:
              'Teslimat sonucu kesinleşmeden güvenli tekrar süresi doldu.',
          },
        });
        this.logger.error(
          `E-posta teslimatı manuel inceleme gerektiriyor (${id}).`,
        );
        return 'FAILED';
      }

      await this.prisma.emailDeliveryRecord.updateMany({
        where: { id, claimToken: token },
        data: {
          attemptCount: { increment: 1 },
          firstAttemptAt: record.firstAttemptAt ?? now,
          lastAttemptAt: now,
        },
      });

      let providerMessageId: string;
      try {
        providerMessageId = await this.post(record);
      } catch (error) {
        const failure =
          error instanceof ResendRequestError
            ? error
            : new ResendRequestError('NETWORK_OR_UNKNOWN', true);
        const nextDelay = Math.max(
          Math.min(60 * 60_000, 30_000 * 2 ** Math.min(record.attemptCount, 7)),
          failure.retryAfterMs,
        );
        await this.prisma.emailDeliveryRecord.updateMany({
          where: { id, claimToken: token },
          data: {
            status: failure.retryable
              ? EmailDeliveryStatus.PENDING
              : EmailDeliveryStatus.FAILED,
            nextAttemptAt: new Date(Date.now() + nextDelay),
            lastErrorCode: failure.code.slice(0, 100),
            lastErrorMessage: failure.message.slice(0, 300),
            ...(!failure.retryable ? { html: null } : {}),
          },
        });
        this.logger.warn(
          `Resend isteği ${failure.retryable ? 'yeniden denenecek' : 'kalıcı olarak başarısız'} (${id}, ${failure.code}).`,
        );
        return failure.retryable ? 'DEFERRED' : 'FAILED';
      }

      await this.prisma.emailDeliveryRecord.updateMany({
        where: { id, claimToken: token },
        data: {
          status: EmailDeliveryStatus.SENT,
          providerMessageId,
          sentAt: new Date(),
          html: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return 'SENT';
    } finally {
      await this.prisma.emailDeliveryRecord.updateMany({
        where: { id, claimToken: token },
        data: { claimToken: null, claimUntil: null },
      });
    }
  }

  private async post(record: {
    deliveryKey: string;
    senderEmail: string;
    recipientEmail: string;
    subject: string;
    html: string | null;
  }) {
    if (!record.html) throw new ResendRequestError('PAYLOAD_MISSING', false);
    await this.assertInvitationValid(record.deliveryKey);
    const html = this.decryptHtml(record.html);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': record.deliveryKey,
      },
      body: JSON.stringify({
        from: record.senderEmail,
        to: [record.recipientEmail],
        subject: record.subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500 ||
        (response.status === 409 &&
          body.includes('concurrent_idempotent_requests'));
      throw new ResendRequestError(
        response.status === 409 && body.includes('invalid_idempotent_request')
          ? 'INVALID_IDEMPOTENT_REQUEST'
          : `HTTP_${response.status}`,
        retryable,
        retryAfterMs(response.headers.get('retry-after')),
      );
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('id' in body))
      throw new ResendRequestError('INVALID_RESPONSE', true);
    const id = body.id;
    if (typeof id !== 'string' || !id)
      throw new ResendRequestError('INVALID_RESPONSE', true);
    return id;
  }

  private async assertInvitationValid(deliveryKey: string) {
    if (!deliveryKey.startsWith('team-invite:')) return;
    const [, id, tokenHash, ...rest] = deliveryKey.split(':');
    if (!id || !tokenHash || rest.length) {
      throw new ResendRequestError('INVITATION_INVALID', false);
    }
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id },
      select: { tokenHash: true, status: true, expiresAt: true },
    });
    if (
      !invitation ||
      invitation.tokenHash !== tokenHash ||
      invitation.status !== WorkspaceInvitationStatus.PENDING ||
      invitation.expiresAt <= new Date()
    ) {
      throw new ResendRequestError('INVITATION_INVALID', false);
    }
  }

  private encryptHtml(html: string) {
    this.encryption ??= new CredentialsEncryptionService();
    return `encrypted:${this.encryption.encrypt({ html })}`;
  }

  private decryptHtml(value: string) {
    if (!value.startsWith('encrypted:')) return value;
    try {
      this.encryption ??= new CredentialsEncryptionService();
      const html = this.encryption.decrypt(
        value.slice('encrypted:'.length),
      ).html;
      if (!html) throw new Error('Encrypted email payload is empty.');
      return html;
    } catch {
      throw new ResendRequestError('ENCRYPTED_PAYLOAD_INVALID', false);
    }
  }
}

function retryAfterMs(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1_000, 60 * 60_000);
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.min(date - Date.now(), 60 * 60_000))
    : 0;
}
