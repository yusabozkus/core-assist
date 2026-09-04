export type ProductSyncJobData = {
  storeId: string;
  connectionId: string;
  syncRunId: string;
  kind: ProductSyncKind;
};

export type ProductSyncKind = 'FULL' | 'INVENTORY';
export type ProductSyncTrigger =
  'MANUAL' | 'SCHEDULED' | 'RETRY' | 'ONBOARDING';

export type ProductSyncEnqueueOptions = {
  trigger?: ProductSyncTrigger;
  retryOfId?: string;
};

export type QueuedProductSync = {
  syncRunId: string;
  status: 'RUNNING';
  queuedAt: Date;
  kind: ProductSyncKind;
};

export interface ProductSyncDispatcher {
  enqueue(
    storeId: string,
    connectionId: string,
    kind?: ProductSyncKind,
    options?: ProductSyncEnqueueOptions,
  ): Promise<QueuedProductSync>;
}
