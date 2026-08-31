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

export interface QuestionSyncDispatcher {
  enqueue(storeId: string, connectionId: string): Promise<QueuedQuestionSync>;
}
