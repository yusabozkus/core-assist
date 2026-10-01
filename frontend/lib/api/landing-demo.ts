import { getApiUrl } from "@/lib/api/client"

export type LandingDemoProduct = {
  id: string
  title: string
  subtitle: string
  category: string
  color: string
  art: "jogger" | "denim" | "top" | "dress" | "jacket"
  highlights: string[]
  examples: string[]
}

export type LandingDemoAnswer = {
  answer: string
  needsReview: boolean
  sources: string[]
  usage: LandingDemoUsage
}

export type LandingDemoUsage = {
  limit: number
  remaining: number
  resetAt: string | null
}

export class LandingDemoApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly usage?: LandingDemoUsage
  ) {
    super(message)
    this.name = "LandingDemoApiError"
  }
}

function parseUsage(value: unknown): LandingDemoUsage | undefined {
  if (!value || typeof value !== "object") return undefined
  const usage = value as Record<string, unknown>
  if (
    typeof usage.limit !== "number" ||
    typeof usage.remaining !== "number" ||
    (usage.resetAt !== null && typeof usage.resetAt !== "string")
  ) {
    return undefined
  }
  return {
    limit: usage.limit,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
  }
}

async function readDemoResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Demo şu anda kullanılamıyor. Lütfen biraz sonra yeniden deneyin."
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : undefined
    throw new LandingDemoApiError(message, code, parseUsage(payload))
  }

  return payload as T
}

export async function getLandingDemoUsage(signal?: AbortSignal) {
  const response = await fetch(getApiUrl("/landing-demo/usage"), {
    cache: "no-store",
    credentials: "omit",
    signal,
  })
  return readDemoResponse<LandingDemoUsage>(response)
}

export async function getLandingDemoProducts(signal?: AbortSignal) {
  const response = await fetch(getApiUrl("/landing-demo/products"), {
    cache: "no-store",
    credentials: "omit",
    signal,
  })
  return readDemoResponse<LandingDemoProduct[]>(response)
}

export async function askLandingDemoQuestion(
  productId: string,
  question: string,
  signal?: AbortSignal
) {
  const response = await fetch(getApiUrl("/landing-demo/answer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, question }),
    cache: "no-store",
    credentials: "omit",
    signal,
  })
  return readDemoResponse<LandingDemoAnswer>(response)
}
