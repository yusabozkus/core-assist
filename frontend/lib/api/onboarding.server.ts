import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import { cache } from "react"

import type { OnboardingStatus } from "@/types/onboarding"

const ONBOARDING_STATUS_REQUEST_TIMEOUT_MS = 8_000

export class OnboardingStatusUnavailableError extends Error {
  readonly code = "ONBOARDING_STATUS_UNAVAILABLE"

  constructor(cause?: unknown) {
    super("Onboarding status is temporarily unavailable.", { cause })
    this.name = "OnboardingStatusUnavailableError"
  }
}

export const getOnboardingStatus = cache(
  async (): Promise<OnboardingStatus | null> => {
    const cookie = (await headers()).get("cookie")

    if (!cookie) {
      return null
    }

    let response: Response

    try {
      response = await fetchServerApi(`/onboarding/status`, {
        cookie,
        timeoutMs: ONBOARDING_STATUS_REQUEST_TIMEOUT_MS,
      })
    } catch (error) {
      throw new OnboardingStatusUnavailableError(error)
    }

    if (response.status === 401 || response.status === 403) {
      return null
    }

    if (!response.ok) {
      throw new OnboardingStatusUnavailableError(
        new Error(
          `Onboarding status request failed with status ${response.status}`
        )
      )
    }

    let status: unknown

    try {
      status = await response.json()
    } catch (error) {
      throw new OnboardingStatusUnavailableError(error)
    }

    if (
      !status ||
      typeof status !== "object" ||
      typeof (status as { completed?: unknown }).completed !== "boolean"
    ) {
      throw new OnboardingStatusUnavailableError(
        new Error("Onboarding status response is invalid")
      )
    }

    return status as OnboardingStatus
  }
)
