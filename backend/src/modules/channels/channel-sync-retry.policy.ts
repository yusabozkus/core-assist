import {
  CatalogSyncKind,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  StoreStatus,
} from '../../generated/prisma/enums';
import {
  hasBillingAccess,
  type SubscriptionAccessState,
} from '../billing/billing-access.policy';
import { PRODUCT_SYNC_LOCK_TIMEOUT_MS } from '../product-sync/product-sync.constants';
import { QUESTION_SYNC_LOCK_TIMEOUT_MS } from '../question-sync/question-sync.constants';

export type ChannelSyncRetryBlockedCode =
  | 'RUN_NOT_FAILED'
  | 'CONNECTION_REMOVED'
  | 'STORE_INACTIVE'
  | 'CREDENTIALS_MISSING'
  | 'CONNECTION_UNAVAILABLE'
  | 'QUESTION_SYNC_UNSUPPORTED'
  | 'CONNECTION_NOT_READY'
  | 'SYNC_IN_PROGRESS'
  | 'BILLING_ACCESS_INACTIVE';

type ChannelSyncRetryContext = {
  runStatus: CatalogSyncStatus;
  kind: CatalogSyncKind;
  storeStatus: StoreStatus;
  connectionStatus: ChannelConnectionStatus;
  credentialsEncrypted: string | null;
  connectedAt: Date | null;
  removedAt: Date | null;
  processingStartedAt: Date | null;
  questionSyncStartedAt: Date | null;
  supportsProductQuestions: boolean;
  subscription: SubscriptionAccessState | null | undefined;
};

export type ChannelSyncRetryEligibility = {
  canRetry: boolean;
  code: ChannelSyncRetryBlockedCode | null;
  reason: string | null;
};

export function getChannelSyncRetryEligibility(
  context: ChannelSyncRetryContext,
  now = new Date(),
): ChannelSyncRetryEligibility {
  if (context.runStatus !== CatalogSyncStatus.FAILED) {
    return blocked(
      'RUN_NOT_FAILED',
      'Yalnızca başarısız senkronizasyonlar yeniden denenebilir.',
    );
  }
  if (context.removedAt) {
    return blocked(
      'CONNECTION_REMOVED',
      'Kaldırılmış kanal bağlantısı yeniden denenemez.',
    );
  }
  if (context.storeStatus !== StoreStatus.ACTIVE) {
    return blocked(
      'STORE_INACTIVE',
      'Mağaza aktif olmadığı için senkronizasyon yeniden başlatılamaz.',
    );
  }
  if (!context.credentialsEncrypted) {
    return blocked(
      'CREDENTIALS_MISSING',
      'Yeniden denemeden önce kanal bağlantı bilgilerini tamamlayın.',
    );
  }
  if (
    context.connectionStatus !== ChannelConnectionStatus.CONNECTED &&
    context.connectionStatus !== ChannelConnectionStatus.ERROR
  ) {
    return blocked(
      'CONNECTION_UNAVAILABLE',
      'Yeniden denemeden önce kanal bağlantısını yeniden bağlayın.',
    );
  }
  if (
    context.kind === CatalogSyncKind.QUESTION &&
    !context.supportsProductQuestions
  ) {
    return blocked(
      'QUESTION_SYNC_UNSUPPORTED',
      'Bu kanal ürün sorusu senkronizasyonunu desteklemiyor.',
    );
  }
  if (context.kind === CatalogSyncKind.QUESTION && !context.connectedAt) {
    return blocked(
      'CONNECTION_NOT_READY',
      'Kanal bağlantısı henüz senkronizasyon için hazır değil.',
    );
  }

  const activeLock =
    context.kind === CatalogSyncKind.QUESTION
      ? context.questionSyncStartedAt
      : context.processingStartedAt;
  const lockTimeout =
    context.kind === CatalogSyncKind.QUESTION
      ? QUESTION_SYNC_LOCK_TIMEOUT_MS
      : PRODUCT_SYNC_LOCK_TIMEOUT_MS;
  if (activeLock && activeLock.getTime() >= now.getTime() - lockTimeout) {
    return blocked(
      'SYNC_IN_PROGRESS',
      'Bu kanal için aynı türde başka bir senkronizasyon çalışıyor.',
    );
  }

  if (!hasBillingAccess(context.subscription, now)) {
    return blocked(
      'BILLING_ACCESS_INACTIVE',
      'Abonelik erişimi aktif olmadığı için senkronizasyon yeniden başlatılamaz.',
    );
  }

  return { canRetry: true, code: null, reason: null };
}

function blocked(
  code: ChannelSyncRetryBlockedCode,
  reason: string,
): ChannelSyncRetryEligibility {
  return { canRetry: false, code, reason };
}
