export type QuestionDraftJobData = {
  storeId: string;
  questionId: string;
  reason?: 'AUTOMATION' | 'KNOWLEDGE_RESOLVED';
  requestedByUserId?: string;
};

export interface QuestionDraftDispatcher {
  enqueue(
    storeId: string,
    questionId: string,
    options?: Pick<QuestionDraftJobData, 'reason' | 'requestedByUserId'>,
  ): Promise<void>;
}
