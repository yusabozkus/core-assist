export type QuestionAnswerJobData = {
  storeId: string;
  answerId: string;
};

export type QueueQuestionAnswerInput = {
  storeId: string;
  questionId: string;
  requestedByUserId: string;
  answer: string;
};

export type QueuedQuestionAnswer = {
  id: string;
  status: 'QUEUED';
  queuedAt: Date;
};

export interface QuestionAnswerDispatcher {
  enqueue(input: QueueQuestionAnswerInput): Promise<QueuedQuestionAnswer>;
}
