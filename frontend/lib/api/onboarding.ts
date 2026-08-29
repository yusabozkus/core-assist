import { apiFetch } from "@/lib/api/client"
import type {
  CompleteOnboardingPayload,
  CompleteOnboardingResponse,
} from "@/types/onboarding"

export function completeOnboarding(payload: CompleteOnboardingPayload) {
  return apiFetch<CompleteOnboardingResponse>("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
