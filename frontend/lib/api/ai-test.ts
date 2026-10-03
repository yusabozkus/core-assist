import { apiFetch } from "@/lib/api/client"

export type AiTestResult =
  | {
      answer: null
      decision: "DO_NOT_REPLY"
      policyReason: "ABUSIVE_CONTENT"
      providerKey: string
    }
  | {
      answer: string
      decision: "READY_FOR_SEND" | "NEEDS_REVIEW"
      providerKey: string
      requestedFacts: string[]
      detectedFacts: string[]
      answerability: "FULL" | "PARTIAL" | "INSUFFICIENT" | "OUT_OF_SCOPE"
      confidence: number
      interpretation: string
      missingInformation: string[]
      risks: string[]
      evidence: Array<{
        id: string
        label: string
        value: string
        source: string
      }>
      model: string
      automationMode: "OFF" | "SHADOW" | "SAFE_AUTO"
      autoSend: {
        eligible: boolean
        wouldAutoSend: boolean
        appliedConfidenceThreshold: number
        reasons: string[]
      }
      previewOnly: true
    }

export function previewAiAnswer(
  storeId: string,
  input: { productId: string; providerKey?: string; question: string },
  signal?: AbortSignal
) {
  return apiFetch<AiTestResult>(`/stores/${storeId}/ai-test`, {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  })
}
