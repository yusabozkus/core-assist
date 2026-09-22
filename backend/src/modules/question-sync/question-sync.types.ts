export type QuestionSyncJobData = {
  storeId: string;
  connectionId: string;
  syncRunId: string;
  recoverErroredConnection?: boolean;
};

export type QueuedQuestionSync = {
  syncRunId: string;
  connectionId: string;
  status: 'RUNNING';
  queuedAt: Date;
};

export type QuestionSyncEnqueueOptions = {
  trigger?: 'MANUAL' | 'SCHEDULED' | 'RETRY' | 'ONBOARDING';
  retryOfId?: string;
  recoverErroredConnection?: boolean;
};

export interface QuestionSyncDispatcher {
  enqueue(
    storeId: string,
    connectionId: string,
    options?: QuestionSyncEnqueueOptions,
  ): Promise<QueuedQuestionSync>;
}
