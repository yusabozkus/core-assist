import { apiFetch } from "@/lib/api/client"
import type {
  CompleteOnboardingPayload,
  CompleteOnboardingResponse,
  ProvisionOnboardingPayload,
  ProvisionOnboardingResponse,
} from "@/types/onboarding"

export function provisionOnboarding(payload: ProvisionOnboardingPayload) {
  return apiFetch<ProvisionOnboardingResponse>("/onboarding/provision", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function completeOnboarding(payload: CompleteOnboardingPayload) {
  return apiFetch<CompleteOnboardingResponse>("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function completeAdditionalStoreOnboarding(
  payload: CompleteOnboardingPayload
) {
  return apiFetch<CompleteOnboardingResponse>("/onboarding/stores/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
