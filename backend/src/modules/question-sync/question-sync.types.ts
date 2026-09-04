export type QuestionSyncJobData = {
  storeId: string;
  connectionId: string;
  syncRunId: string;
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
};

export interface QuestionSyncDispatcher {
  enqueue(
    storeId: string,
    connectionId: string,
    options?: QuestionSyncEnqueueOptions,
  ): Promise<QueuedQuestionSync>;
}
