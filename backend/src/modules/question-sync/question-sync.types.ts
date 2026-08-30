export type QuestionSyncJobData = {
  storeId: string;
  connectionId: string;
};

export type QueuedQuestionSync = {
  connectionId: string;
  status: 'RUNNING';
  queuedAt: Date;
};

export interface QuestionSyncDispatcher {
  enqueue(storeId: string, connectionId: string): Promise<QueuedQuestionSync>;
}
