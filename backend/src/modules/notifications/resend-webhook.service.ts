import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  parseResendEvent,
  precedingEmailStatuses,
  verifyResendSignature,
} from './resend-webhook.policy';

@Injectable()
export class ResendWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async receive(
    rawBody: Buffer,
    headers: { id?: string; timestamp?: string; signature?: string },
  ) {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'E-posta teslimat takibi yapılandırılmadı.',
      );
    if (!verifyResendSignature(rawBody, headers, secret))
      throw new UnauthorizedException('Geçersiz webhook imzası.');
    let event: ReturnType<typeof parseResendEvent>;
    try {
      event = parseResendEvent(JSON.parse(rawBody.toString('utf8')) as unknown);
    } catch {
      throw new BadRequestException('Geçersiz e-posta olayı.');
    }
    if (!event) return { received: true, ignored: true };
    const accepted = event;
    return this.prisma.$transaction(async (transaction) => {
      // The upsert locks the shared message row and serializes concurrent events.
      await transaction.emailProviderMessage.upsert({
        where: { id: accepted.providerMessageId },
        create: { id: accepted.providerMessageId },
        update: { updatedAt: new Date() },
      });
      const inserted = await transaction.emailDeliveryEvent.createMany({
        data: [{ id: headers.id!, ...accepted }],
        skipDuplicates: true,
      });
      if (!inserted.count) return { received: true, duplicate: true };
      await transaction.emailProviderMessage.updateMany({
        where: {
          id: accepted.providerMessageId,
          OR: [
            { status: { in: precedingEmailStatuses(accepted.status) } },
            {
              status: accepted.status,
              OR: [
                { statusAt: null },
                { statusAt: { lt: accepted.occurredAt } },
              ],
            },
          ],
        },
        data: { status: accepted.status, statusAt: accepted.occurredAt },
      });
      return { received: true, duplicate: false };
    });
  }
}
