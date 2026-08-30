export type ProductSyncJobData = {
  storeId: string;
  connectionId: string;
  syncRunId: string;
  kind: ProductSyncKind;
};

export type ProductSyncKind = 'FULL' | 'INVENTORY';

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
  ): Promise<QueuedProductSync>;
}
