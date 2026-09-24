import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { EmailDeliveryStatus } from '../../generated/prisma/enums';
import {
  escapeEmailHtml,
  renderEmailLayout,
} from '../notifications/email-templates/email-layout';
import { ResendEmailService } from '../notifications/resend-email.service';
import { TeamAccessLevel } from './dto/team-member-access.dto';

export type InvitationEmailStatus = 'SENT' | 'PENDING' | 'FAILED' | 'NOT_SENT';

type InvitationDetails = {
  id: string;
  tokenHash: string;
  email: string;
  expiresAt: Date;
  workspace: { name: string };
  invitedBy: { name: string } | null;
  storeAccesses: Array<{ store: { name: string } }>;
};

@Injectable()
export class TeamInvitationEmailService {
  private readonly logger = new Logger(TeamInvitationEmailService.name);

  constructor(private readonly resend: ResendEmailService) {}

  deliveryKey(invitation: Pick<InvitationDetails, 'id' | 'tokenHash'>) {
    return `team-invite:${invitation.id}:${invitation.tokenHash}`;
  }

  async stage(
    transaction: Prisma.TransactionClient,
    invitation: InvitationDetails,
    token: string,
    accessLevel: TeamAccessLevel,
  ): Promise<string | null> {
    const senderEmail = process.env.NOTIFICATION_EMAIL_FROM?.trim();
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    if (!this.resend.configured || !senderEmail || !frontendUrl) return null;

    const origin = new URL(frontendUrl);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
    ) {
      throw new Error('FRONTEND_URL must use HTTPS in production.');
    }

    const actionUrl = new URL(`/invite/${token}`, origin.origin).toString();
    const role = accessLabel(accessLevel);
    const stores =
      accessLevel === TeamAccessLevel.ACCOUNT_ADMIN
        ? 'Tüm mağazalar'
        : invitation.storeAccesses
            .map((access) => access.store.name)
            .join(', ');
    const expiresAt = new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'long',
      timeZone: 'Europe/Istanbul',
    }).format(invitation.expiresAt);
    const detailsHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#f6f8f6;border:1px solid #e6ebe6;border-radius:8px;margin:0 0 24px"><tr><td style="padding:18px 20px;color:#536158;font-size:13px;line-height:1.8"><strong style="color:#26382c">Yetki:</strong> ${escapeEmailHtml(role)}<br><strong style="color:#26382c">Mağazalar:</strong> ${escapeEmailHtml(stores)}<br><strong style="color:#26382c">Son kabul tarihi:</strong> ${escapeEmailHtml(expiresAt)}</td></tr></table>`;
    const html = renderEmailLayout({
      category: 'Ekip daveti',
      eyebrow: 'Core Asistan ekibine davet edildiniz',
      preheader: `${invitation.workspace.name} ekibine katılma davetiniz hazır.`,
      title: 'Ekibe katılın',
      recipientName: 'ekip üyesi',
      message: `${invitation.invitedBy?.name ?? 'Bir ekip yöneticisi'} sizi ${invitation.workspace.name} ekibine davet etti. Daveti yalnızca bu e-posta adresiyle giriş yaparak kabul edebilirsiniz.`,
      detailsHtml,
      actionUrl,
      actionLabel: 'Daveti kabul et',
      footer:
        'Bu daveti beklemiyorsanız bağlantıyı kullanmayın. Davet bağlantısı 7 gün geçerlidir.',
    });
    const deliveryKey = this.deliveryKey(invitation);
    await this.resend.stage(
      {
        deliveryKey,
        recipientUserId: null,
        storeId: null,
        recipientEmail: invitation.email,
        senderEmail,
        subject: `${invitation.workspace.name} ekibine davet edildiniz`,
        html,
        sensitive: true,
      },
      transaction,
    );
    return deliveryKey;
  }

  async deliver(deliveryKey: string | null): Promise<InvitationEmailStatus> {
    if (!deliveryKey) return 'NOT_SENT';
    try {
      const result = await this.resend.deliverStaged(deliveryKey);
      return result === 'SENT'
        ? 'SENT'
        : result === 'FAILED'
          ? 'FAILED'
          : 'PENDING';
    } catch (error) {
      this.logger.warn(
        `Ekip daveti e-postası gönderim için sırada kaldı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      );
      return 'PENDING';
    }
  }

  async cancelPending(
    transaction: Prisma.TransactionClient,
    invitationId: string,
  ) {
    await this.resend.cancelPendingInvitation(transaction, invitationId);
  }

  status(value: EmailDeliveryStatus | undefined): InvitationEmailStatus {
    if (value === EmailDeliveryStatus.SENT) return 'SENT';
    if (value === EmailDeliveryStatus.PENDING) return 'PENDING';
    if (value) return 'FAILED';
    return 'NOT_SENT';
  }
}

function accessLabel(level: TeamAccessLevel) {
  const labels: Record<TeamAccessLevel, string> = {
    [TeamAccessLevel.ACCOUNT_ADMIN]: 'Hesap yöneticisi',
    [TeamAccessLevel.STORE_ADMIN]: 'Mağaza yöneticisi',
    [TeamAccessLevel.AGENT]: 'Temsilci',
    [TeamAccessLevel.VIEWER]: 'Görüntüleyici',
  };
  return labels[level];
}
