import { apiFetch } from "@/lib/api/client"
import type {
  QuestionSyncResult,
  QueueQuestionAnswerResult,
} from "@/types/question"

export function syncStoreQuestions(storeId: string) {
  return apiFetch<QuestionSyncResult>(`/stores/${storeId}/questions/sync`, {
    method: "POST",
  })
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
