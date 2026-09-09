import { Injectable } from '@nestjs/common';
import {
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';

type AiQuestionUsage = {
  charged: boolean;
  periodId: string | null;
  previousUsed: number;
  used: number;
  limit: number;
  remaining: number;
};

const USAGE_THRESHOLDS = [100, 90, 80] as const;

@Injectable()
export class BillingUsageNotificationService {
  constructor(private readonly notifications: NotificationsService) {}

  async notifyAiQuestionThreshold(storeId: string, usage: AiQuestionUsage) {
    if (!usage.charged || !usage.periodId || usage.limit <= 0) return;

    const previousPercentage = (usage.previousUsed / usage.limit) * 100;
    const currentPercentage = (usage.used / usage.limit) * 100;
    const threshold = USAGE_THRESHOLDS.find(
      (candidate) =>
        previousPercentage < candidate && currentPercentage >= candidate,
    );
    if (!threshold) return;

    const exhausted = threshold === 100;
    await this.notifications.createForStoreMembers({
      storeId,
      type: NotificationType.AI_USAGE_LIMIT,
      severity: exhausted
        ? NotificationSeverity.ERROR
        : NotificationSeverity.WARNING,
      title: exhausted
        ? 'AI soru hakkınız doldu'
        : `AI soru hakkınızın %${threshold}'i kullanıldı`,
      message: exhausted
        ? `${usage.limit.toLocaleString('tr-TR')} soru hakkınızın tamamını kullandınız. Manuel yanıtlamaya devam edebilir veya planınızı yükseltebilirsiniz.`
        : `${usage.used.toLocaleString('tr-TR')} / ${usage.limit.toLocaleString('tr-TR')} soru hakkı kullanıldı. Dönem sonuna kadar ${usage.remaining.toLocaleString('tr-TR')} hakkınız kaldı.`,
      actionUrl: '/dashboard/settings/billing',
      entityType: 'BILLING_USAGE_PERIOD',
      entityId: usage.periodId,
      dedupeKey: `ai-usage:${usage.periodId}:${threshold}`,
    });
  }
}
