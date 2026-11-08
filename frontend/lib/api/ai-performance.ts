import { apiFetch } from "@/lib/api/client"
import type {
  AiPerformanceCursor,
  AiPerformanceDetailScope,
  AiPerformanceQuestionPage,
} from "@/types/ai-performance"

export function getAiPerformanceQuestions(
  storeId: string,
  scope: AiPerformanceDetailScope,
  cursor: AiPerformanceCursor | null,
  signal: AbortSignal
) {
  const params = new URLSearchParams({
    kind: scope.kind,
    range: scope.range,
    asOf: scope.asOf,
    limit: "25",
  })
  if (scope.provider) params.set("provider", scope.provider)
  if (scope.kind === "REVIEW_REASON") params.set("reason", scope.reason)
  if (cursor) {
    params.set("cursor", cursor.questionId)
    params.set("before", cursor.before)
  }
  return apiFetch<AiPerformanceQuestionPage>(
    `/stores/${encodeURIComponent(storeId)}/analytics/ai/questions?${params}`,
    { signal }
  )
}
