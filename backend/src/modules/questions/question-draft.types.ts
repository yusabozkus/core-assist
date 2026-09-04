export type QuestionDraftJobData = {
  storeId: string;
  questionId: string;
};

export interface QuestionDraftDispatcher {
  enqueue(storeId: string, questionId: string): Promise<void>;
}
