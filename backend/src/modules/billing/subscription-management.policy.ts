import type { Subscription } from '@paddle/paddle-node-sdk';
import type { SubscriptionManagementAction } from './dto/manage-subscription.dto';

export function subscriptionManagementState(
  current: Subscription,
  planChangePending: boolean,
  now = Date.now(),
) {
  const cancellationScheduled = current.scheduledChange?.action === 'cancel';
  const accessEndsAt = cancellationScheduled
    ? current.scheduledChange?.effectiveAt
    : current.currentBillingPeriod?.endsAt;
  let action: SubscriptionManagementAction | null = null;
  let blockedReason: string | null = null;

  if (current.status === 'canceled') {
    blockedReason =
      'Bu abonelik sona ermiş. Devam etmek için yeni bir plan seçebilirsiniz.';
  } else if (planChangePending) {
    blockedReason =
      'Devam eden plan değişikliği tamamlandıktan sonra tekrar deneyin.';
  } else if (current.collectionMode !== 'automatic') {
    blockedReason = 'Bu abonelik otomatik ödeme ile yönetilmiyor.';
  } else if (current.status === 'past_due') {
    blockedReason =
      'Ödeme gecikmesi nedeniyle yenileme şu anda değiştirilemiyor. Ödeme durumunu güncelledikten sonra tekrar deneyin.';
  } else if (!['active', 'trialing'].includes(current.status)) {
    blockedReason = 'Bu aboneliğin mevcut durumunda yenileme değiştirilemiyor.';
  } else if (current.scheduledChange && !cancellationScheduled) {
    blockedReason = 'Abonelikte başka bir planlanmış işlem bulunuyor.';
  } else if (
    !accessEndsAt ||
    !Number.isFinite(Date.parse(accessEndsAt)) ||
    Date.parse(accessEndsAt) <= now
  ) {
    blockedReason =
      'Abonelik dönemi henüz doğrulanamadı. Lütfen durumu yeniden kontrol edin.';
  } else if (Date.parse(accessEndsAt) - now <= 30 * 60 * 1000) {
    blockedReason =
      'Dönem bitimine 30 dakikadan az kaldığı için şu anda değişiklik yapılamıyor.';
  } else {
    action = cancellationScheduled ? 'reverse_cancellation' : 'cancel';
  }

  return {
    subscriptionId: current.id,
    updatedAt: current.updatedAt,
    status: current.status,
    cancellationScheduled,
    scheduledChangeAction: current.scheduledChange?.action ?? null,
    accessEndsAt: accessEndsAt ?? null,
    nextBilledAt: current.nextBilledAt,
    action,
    blockedReason,
  };
}

export function subscriptionActionCompleted(
  current: Subscription,
  action: SubscriptionManagementAction,
) {
  return action === 'cancel'
    ? current.scheduledChange?.action === 'cancel' ||
        current.status === 'canceled'
    : ['active', 'trialing', 'past_due'].includes(current.status) &&
        !current.scheduledChange;
}
