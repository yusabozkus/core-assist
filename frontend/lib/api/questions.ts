import { apiFetch } from "@/lib/api/client"
import type {
  DraftQuestionAnswerResult,
  ProductQuestion,
  ProductQuestionFilter,
  ProductQuestionPage,
  QuestionSyncResult,
  QueueQuestionAnswerResult,
} from "@/types/question"

type GetProductQuestionsOptions = {
  cursor?: string | null
  limit?: number
  status?: ProductQuestionFilter
  query?: string
  signal?: AbortSignal
}

export function getProductQuestions(
  storeId: string,
  {
    cursor,
    limit = 30,
    status = "ALL",
    query,
    signal,
  }: GetProductQuestionsOptions = {}
) {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    status,
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())

  return apiFetch<ProductQuestionPage>(
    `/stores/${storeId}/questions?${searchParams.toString()}`,
    { cache: "no-store", signal }
  )
}

export function getProductQuestion(
  storeId: string,
  questionId: string,
  signal?: AbortSignal
) {
  return apiFetch<ProductQuestion>(
    `/stores/${storeId}/questions/${questionId}`,
    { cache: "no-store", signal }
  )
}

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
