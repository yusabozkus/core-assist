import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type {
  ProductQuestionFilter,
  ProductQuestionPage,
  PendingQuestionState,
} from "@/types/question"

const QUESTIONS_REQUEST_TIMEOUT_MS = 8_000

export const getServerProductQuestions = cache(
  async (
    storeId: string,
    {
      limit = 30,
      status = "PENDING",
      query,
      pendingStates,
    }: {
      limit?: number
      status?: ProductQuestionFilter
      query?: string
      pendingStates?: PendingQuestionState[]
    } = {}
  ): Promise<ProductQuestionPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) return emptyQuestionPage()

    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      status,
    })

    if (query?.trim()) searchParams.set("query", query.trim())
    if (pendingStates) {
      searchParams.set("pendingStates", pendingStates.join(","))
    }

    const response = await fetchServerApi(
      `/stores/${storeId}/questions?${searchParams.toString()}`,
      { cookie, timeoutMs: QUESTIONS_REQUEST_TIMEOUT_MS }
    )

    if (!response.ok) {
      throw new Error(
        `Product questions request failed with status ${response.status}.`
      )
    }

    return (await response.json()) as ProductQuestionPage
  }
)

function emptyQuestionPage(): ProductQuestionPage {
  return {
    items: [],
    nextCursor: null,
    total: 0,
    summary: { total: 0, pending: 0, answered: 0, ignored: 0 },
  }
}
