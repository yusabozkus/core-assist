import { apiFetch } from "@/lib/api/client"
import type {
  DraftQuestionAnswerResult,
  ProductQuestion,
  ProductQuestionFilter,
  ProductQuestionListSlice,
  ProductQuestionPage,
  PendingQuestionState,
  QuestionSyncResult,
  QueueQuestionAnswerResult,
  ResolveProductKnowledgeResult,
} from "@/types/question"

type GetProductQuestionsOptions = {
  cursor?: string | null
  limit?: number
  status?: ProductQuestionFilter
  query?: string
  signal?: AbortSignal
  pendingStates?: PendingQuestionState[]
}

export function getProductQuestions(
  storeId: string,
  {
    cursor,
    limit = 30,
    status = "PENDING",
    query,
    signal,
    pendingStates,
  }: GetProductQuestionsOptions = {}
) {
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    status,
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())
  if (pendingStates) {
    searchParams.set("pendingStates", pendingStates.join(","))
  }

  return apiFetch<ProductQuestionPage>(
    `/stores/${storeId}/questions?${searchParams.toString()}`,
    { cache: "no-store", signal }
  )
}

export function getProductQuestionUpdates(
  storeId: string,
  {
    cursor,
    limit = 30,
    status = "PENDING",
    query,
    signal,
    pendingStates,
  }: GetProductQuestionsOptions = {}
) {
  const searchParams = new URLSearchParams({
    includeSummary: "false",
    limit: limit.toString(),
    status,
  })

  if (cursor) searchParams.set("cursor", cursor)
  if (query?.trim()) searchParams.set("query", query.trim())
  if (pendingStates) {
    searchParams.set("pendingStates", pendingStates.join(","))
  }

  return apiFetch<ProductQuestionListSlice>(
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

export function resolveProductQuestionKnowledge(
  storeId: string,
  questionId: string,
  input: {
    gapKey: string
    value: string
    variantId?: string
    confirmUnusualValue?: boolean
  }
) {
  return apiFetch<ResolveProductKnowledgeResult>(
    `/stores/${storeId}/questions/${questionId}/knowledge`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}
