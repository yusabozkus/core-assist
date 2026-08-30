import { apiFetch } from "@/lib/api/client"
import type {
  DraftQuestionAnswerResult,
  QuestionSyncResult,
  QueueQuestionAnswerResult,
} from "@/types/question"

export function syncStoreQuestions(storeId: string) {
  return apiFetch<QuestionSyncResult>(`/stores/${storeId}/questions/sync`, {
    method: "POST",
  })
}

export function generateProductQuestionDraft(
  storeId: string,
  questionId: string
) {
  return apiFetch<DraftQuestionAnswerResult>(
    `/stores/${storeId}/questions/${questionId}/draft`,
    { method: "POST" }
  )
}

export function answerProductQuestion(
  storeId: string,
  questionId: string,
  answer: string
) {
  return apiFetch<QueueQuestionAnswerResult>(
    `/stores/${storeId}/questions/${questionId}/answer`,
    {
      method: "POST",
      body: JSON.stringify({ answer }),
    }
  )
}
