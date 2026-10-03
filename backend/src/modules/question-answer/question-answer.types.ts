export type QuestionAnswerJobData = {
  storeId: string;
  answerId: string;
  // Fences old Redis jobs after an explicitly requested new delivery attempt.
  queuedAt?: string;
};

type QueueManualQuestionAnswerInput = {
  storeId: string;
  questionId: string;
  requestedByUserId: string;
  origin?: 'MANUAL';
  answer: string;
  draftAttemptId?: string;
};

type QueueAutomatedQuestionAnswerInput = {
  storeId: string;
  questionId: string;
  requestedByUserId?: never;
  origin: 'AUTOMATION';
  answer: string;
  draftAttemptId: string;
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
