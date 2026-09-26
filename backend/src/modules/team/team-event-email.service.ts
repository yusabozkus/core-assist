import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  escapeEmailHtml,
  renderEmailLayout,
} from '../notifications/email-templates/email-layout';
import { ResendEmailService } from '../notifications/resend-email.service';
import { TeamAccessLevel } from './dto/team-member-access.dto';

type TeamEvent =
  | { kind: 'ACCEPTED'; memberName: string }
  | { kind: 'ACCESS_CHANGED'; accessLevel: TeamAccessLevel; storeIds: string[] }
  | { kind: 'REMOVED' };

@Injectable()
export class TeamEventEmailService {
  private readonly logger = new Logger(TeamEventEmailService.name);

  constructor(private readonly resend: ResendEmailService) {}

  async stage(
    transaction: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      recipientUserIds: string[];
      eventKey: string;
      event: TeamEvent;
    },
  ) {
    const senderEmail = process.env.NOTIFICATION_EMAIL_FROM?.trim();
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    if (!this.resend.configured || !senderEmail || !frontendUrl) return [];
    const origin = new URL(frontendUrl);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
    ) {
      throw new Error('FRONTEND_URL must use HTTPS in production.');
    }

    const recipientUserIds = [...new Set(input.recipientUserIds)];
    if (!recipientUserIds.length) return [];
    const [workspace, recipients, stores] = await Promise.all([
      transaction.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { name: true },
      }),
      transaction.user.findMany({
        where: { id: { in: recipientUserIds } },
        select: { id: true, name: true, email: true },
      }),
      input.event.kind === 'ACCESS_CHANGED' && input.event.storeIds.length
        ? transaction.store.findMany({
            where: {
              workspaceId: input.workspaceId,
              id: { in: input.event.storeIds },
            },
            select: { name: true },
          })
        : Promise.resolve<Array<{ name: string }>>([]),
    ]);
    if (!workspace) throw new Error('Team email workspace not found.');

    const event = describeEvent(
      input.event,
      workspace.name,
      stores.map((store) => store.name),
    );
    const actionUrl = new URL(event.actionPath, origin.origin).toString();
    const keys: string[] = [];
    for (const recipient of recipients) {
      const deliveryKey = `team-event:${input.eventKey}:${recipient.id}`;
      await this.resend.stage(
        {
          deliveryKey,
          recipientUserId: recipient.id,
          storeId: null,
          workspaceId: input.workspaceId,
          emailType: 'TEAM_EVENT',
          recipientEmail: recipient.email,
          senderEmail,
          subject: event.subject,
          html: renderEmailLayout({
            category: 'Ekip',
            eyebrow: 'Ekip güncellemesi',
            preheader: event.message,
            title: event.subject,
            recipientName: recipient.name,
            message: event.message,
            detailsHtml: event.detailsHtml,
            actionUrl,
            actionLabel: event.actionLabel,
            footer:
              'Bu e-posta ekip erişiminizdeki önemli bir değişiklik nedeniyle gönderilmiştir.',
          }),
          sensitive: true,
        },
        transaction,
      );
      keys.push(deliveryKey);
    }
    return keys;
  }

  async deliver(keys: string[]) {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.resend.deliverStaged(key);
        } catch (error) {
          this.logger.warn(
            `Ekip e-postası gönderim için sırada kaldı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          );
        }
      }),
    );
  }
}

function describeEvent(
  event: TeamEvent,
  workspaceName: string,
  storeNames: string[],
) {
  if (event.kind === 'ACCEPTED') {
    return {
      subject: 'Ekip daveti kabul edildi',
      message: `${event.memberName}, ${workspaceName} ekibine katıldı.`,
      detailsHtml: detailRows([
        ['Hesap', workspaceName],
        ['Yeni üye', event.memberName],
      ]),
      actionPath: '/dashboard/team',
      actionLabel: 'Ekibi görüntüle',
    };
  }
  if (event.kind === 'ACCESS_CHANGED') {
    return {
      subject: 'Ekip erişiminiz güncellendi',
      message: `${workspaceName} hesabındaki rolünüz veya mağaza erişiminiz değiştirildi.`,
      detailsHtml: detailRows([
        ['Yeni rol', accessLabel(event.accessLevel)],
        [
          'Mağazalar',
          event.accessLevel === TeamAccessLevel.ACCOUNT_ADMIN
            ? 'Tüm mağazalar'
            : storeNames.join(', '),
        ],
      ]),
      actionPath: '/dashboard',
      actionLabel: 'Hesabı görüntüle',
    };
  }
  return {
    subject: 'Ekip erişiminiz sonlandırıldı',
    message: `${workspaceName} hesabındaki ekip üyeliğiniz ve mağaza erişimleriniz kaldırıldı. Bu işlemi beklemiyorsanız hesap yöneticinizle iletişime geçin.`,
    detailsHtml: detailRows([
      ['Hesap', workspaceName],
      ['Durum', 'Erişim kaldırıldı'],
    ]),
    actionPath: '/auth/continue',
    actionLabel: 'Core Asistan’a git',
  };
}

function detailRows(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#f6f8f6;border:1px solid #e6ebe6;border-radius:8px;margin:0 0 24px"><tr><td style="padding:18px 20px;color:#536158;font-size:13px;line-height:1.8">${rows.map(([label, value]) => `<strong style="color:#26382c">${escapeEmailHtml(label)}:</strong> ${escapeEmailHtml(value)}<br>`).join('')}</td></tr></table>`;
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
