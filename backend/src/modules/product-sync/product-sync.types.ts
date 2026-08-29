export type ProductSyncJobData = {
  storeId: string;
  connectionId: string;
  syncRunId: string;
};

export type QueuedProductSync = {
  syncRunId: string;
  status: 'RUNNING';
  queuedAt: Date;
};

export interface ProductSyncDispatcher {
  enqueue(storeId: string, connectionId: string): Promise<QueuedProductSync>;
}
