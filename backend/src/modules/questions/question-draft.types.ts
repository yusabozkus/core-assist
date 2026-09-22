export type QuestionDraftJobData = {
  storeId: string;
  questionId: string;
  reason?: 'AUTOMATION' | 'KNOWLEDGE_RESOLVED';
  requestedByUserId?: string;
};

export type ApplyAutomationSettingsJobData = {
  storeId: string;
};

export type QuestionDraftQueueJobData =
  QuestionDraftJobData | ApplyAutomationSettingsJobData;

export interface QuestionDraftDispatcher {
  enqueue(
    storeId: string,
    questionId: string,
    options?: Pick<QuestionDraftJobData, 'reason' | 'requestedByUserId'>,
  ): Promise<void>;
  scheduleAutomationSettingsApply(storeId: string): Promise<void>;
}
