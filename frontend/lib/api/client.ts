import { redirectToLoginAfterUnauthorized } from "@/lib/auth-navigation"

type ApiErrorPayload = {
  code?: string
  field?: string
  message?: string | string[]
  retryAfterSeconds?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly field?: string
  readonly retryAfterSeconds?: number

  constructor(status: number, payload?: ApiErrorPayload) {
    super(getErrorMessage(payload, status))
    this.name = "ApiError"
    this.status = status
    this.code = payload?.code
    this.field = payload?.field
    this.retryAfterSeconds = payload?.retryAfterSeconds
  }
}

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001"
).replace(/\/$/, "")

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const requestHeaders = new Headers(init.headers)
  requestHeaders.set("Accept", "application/json")

  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData

  if (init.body && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: requestHeaders,
  })

  const payload = await readJson(response)

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      payload as ApiErrorPayload | undefined
    )

    if (response.status === 401) {
      redirectToLoginAfterUnauthorized()
    }

    throw error
  }

  return payload as T
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")

  if (!contentType?.includes("application/json")) {
    return undefined
  }

  return response.json()
}

function getErrorMessage(payload: ApiErrorPayload | undefined, status: number) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(" ")
  }

  if (payload?.message) {
    return payload.message
  }

  return `Request failed with status ${status}.`
}
