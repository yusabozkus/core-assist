import { NotificationType } from '../../generated/prisma/enums';
import type { AiEmailEvent } from './email-templates/ai-email.template';

export const DEFAULT_NOTIFICATION_DELIVERY_SETTINGS = {
  browserEnabled: false,
  emailEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  timezone: 'Europe/Istanbul',
};

export function isCriticalQuotaEmail(input: {
  type: NotificationType;
  aiEmail?: AiEmailEvent;
}) {
  const usage = input.aiEmail;
  return (
    input.type === NotificationType.AI_USAGE_LIMIT &&
    usage?.kind === 'USAGE' &&
    Number.isFinite(usage.used) &&
    Number.isFinite(usage.limit) &&
    usage.limit > 0 &&
    usage.used >= usage.limit * 0.9
  );
}

export function notificationEmailDeliveryKey(
  notification: { id: string; occurrenceCount: number },
  type: NotificationType,
) {
  // Quota notification IDs already identify workspace period + threshold + user.
  // Replays and another marketplace must not create another email occurrence.
  return type === NotificationType.AI_USAGE_LIMIT
    ? `notification:${notification.id}`
    : `notification:${notification.id}:${notification.occurrenceCount}`;
}
