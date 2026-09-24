import { NotificationType } from '../../generated/prisma/enums';

export const FINANCE_TRANSACTIONAL_EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.BILLING_PAYMENT_ISSUE,
  NotificationType.BILLING_SUBSCRIPTION_CHANGED,
  NotificationType.BILLING_CANCELLATION,
  NotificationType.BILLING_REFUND,
]);

export const SECURITY_TRANSACTIONAL_EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.SECURITY_ACCOUNT_CHANGED,
  NotificationType.SECURITY_SESSIONS_REVOKED,
]);
