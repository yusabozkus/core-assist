import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import type {
  ProductQuestionFilter,
  ProductQuestionPage,
} from "@/types/question"

const QUESTIONS_REQUEST_TIMEOUT_MS = 8_000

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export const getServerProductQuestions = cache(
  async (
    storeId: string,
    {
      limit = 30,
      status = "PENDING",
      query,
    }: {
      limit?: number
      status?: ProductQuestionFilter
      query?: string
    } = {}
  ): Promise<ProductQuestionPage> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) return emptyQuestionPage()

    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      status,
    })

    if (query?.trim()) searchParams.set("query", query.trim())

    const response = await fetch(
      `${apiUrl}/stores/${storeId}/questions?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          cookie,
        },
        signal: AbortSignal.timeout(QUESTIONS_REQUEST_TIMEOUT_MS),
      }
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
