export type QuestionAnswerJobData = {
  storeId: string;
  answerId: string;
};

type QueueManualQuestionAnswerInput = {
  storeId: string;
  questionId: string;
  requestedByUserId: string;
  origin?: 'MANUAL';
  answer: string;
};

type QueueAutomatedQuestionAnswerInput = {
  storeId: string;
  questionId: string;
  requestedByUserId?: never;
  origin: 'AUTOMATION';
  answer: string;
};

export type QueueQuestionAnswerInput =
  QueueManualQuestionAnswerInput | QueueAutomatedQuestionAnswerInput;

export type QueuedQuestionAnswer = {
  id: string;
  status: 'QUEUED';
  queuedAt: Date;
};

export interface QuestionAnswerDispatcher {
  enqueue(input: QueueQuestionAnswerInput): Promise<QueuedQuestionAnswer>;
}
