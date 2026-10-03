import type { StoreKnowledge } from "@/types/knowledge"
import type { ProductQuestionPage } from "@/types/question"

type QuestionSummary = ProductQuestionPage["summary"]

export type SetupGuideProgress = {
  percentage: number
  aiStepComplete: boolean
  storeInformationAdded: boolean
  channelsVisited: boolean
  teamVisited: boolean
  teamStepRequired: boolean
  faqAdded: boolean
  hasQuestions: boolean
  hasAnsweredQuestion: boolean
  nextStep: "AI" | "STORE" | "CHANNELS" | "TEAM" | "FAQ" | "INBOX"
}

type SetupGuideVisits = {
  aiSettingsVisited?: boolean
  channelsVisited?: boolean
  teamVisited?: boolean
  canManageTeam?: boolean
}

export type SetupGuidePreviewState = {
  phase: "essential" | "optional" | "done"
  aiSettingsVisited: boolean
  storeVisited: boolean
  faqVisited: boolean
  inboxVisited: boolean
  channelsVisited: boolean
  teamVisited: boolean
  skippedFaq: boolean
}

export const initialSetupGuidePreviewState: SetupGuidePreviewState = {
  phase: "essential",
  aiSettingsVisited: false,
  storeVisited: false,
  faqVisited: false,
  inboxVisited: false,
  channelsVisited: false,
  teamVisited: false,
  skippedFaq: false,
}

export function getSetupGuidePreviewProgress(
  actual: SetupGuideProgress,
  preview: SetupGuidePreviewState
): SetupGuideProgress {
  const {
    aiSettingsVisited,
    storeVisited,
    channelsVisited,
    teamVisited,
    faqVisited,
    inboxVisited,
  } = preview
  return {
    ...actual,
    percentage: Math.round(
      ((Number(aiSettingsVisited) +
        Number(storeVisited) +
        Number(channelsVisited) +
        Number(actual.teamStepRequired && teamVisited)) /
        (actual.teamStepRequired ? 4 : 3)) *
        100
    ),
    aiStepComplete: aiSettingsVisited,
    storeInformationAdded: storeVisited,
    channelsVisited,
    teamVisited,
    faqAdded: faqVisited,
    hasAnsweredQuestion: inboxVisited,
    nextStep: !aiSettingsVisited
      ? "AI"
      : !storeVisited
        ? "STORE"
        : !channelsVisited
          ? "CHANNELS"
          : actual.teamStepRequired && !teamVisited
            ? "TEAM"
            : !faqVisited
              ? "FAQ"
              : "INBOX",
  }
}

const DEFAULT_INSTRUCTIONS = new Set([
  "Müşteriye her zaman siz diliyle hitap et.",
  "Ürün adını yalnızca cevabı anlaşılır hâle getiriyorsa kullan; gereksiz yere tekrar etme.",
  "Beden önerilerinde ürünün beden tablosunu ve müşterinin paylaştığı ölçüleri birlikte değerlendir.",
])

function hasText(value: string | null) {
  return Boolean(value?.trim())
}

export function getSetupGuideProgress(
  knowledge: StoreKnowledge,
  questions: QuestionSummary | null,
  {
    aiSettingsVisited = false,
    channelsVisited = false,
    teamVisited = false,
    canManageTeam = true,
  }: SetupGuideVisits = {}
): SetupGuideProgress {
  const { profile } = knowledge
  const aiPersonalized =
    profile.tone !== "PROFESSIONAL" ||
    profile.responseLength !== "BALANCED" ||
    profile.automationMode !== "OFF" ||
    !profile.greetingEnabled ||
    !profile.closingEnabled ||
    profile.heightWeightSizeRecommendationEnabled ||
    profile.emojiPolicy !== "NEVER" ||
    hasText(profile.preferredEmoji) ||
    knowledge.instructions.some(
      (instruction) =>
        instruction.active &&
        hasText(instruction.content) &&
        !DEFAULT_INSTRUCTIONS.has(instruction.content.trim())
    )
  const aiStepComplete = aiSettingsVisited || aiPersonalized
  const storeInformationAdded = [
    profile.brandDescription,
    profile.shippingPolicy,
    profile.returnPolicy,
    profile.exchangePolicy,
    profile.warrantyPolicy,
    profile.additionalInformation,
  ].some(hasText)
  const faqAdded = knowledge.faqs.some(
    (faq) => faq.active && hasText(faq.question) && hasText(faq.answer)
  )

  return {
    percentage: Math.round(
      ((Number(aiStepComplete) +
        Number(storeInformationAdded) +
        Number(channelsVisited) +
        Number(canManageTeam && teamVisited)) /
        (canManageTeam ? 4 : 3)) *
        100
    ),
    aiStepComplete,
    storeInformationAdded,
    channelsVisited,
    teamVisited,
    teamStepRequired: canManageTeam,
    faqAdded,
    hasQuestions: (questions?.total ?? 0) > 0,
    hasAnsweredQuestion: (questions?.answered ?? 0) > 0,
    nextStep: !aiStepComplete
      ? "AI"
      : !storeInformationAdded
        ? "STORE"
        : !channelsVisited
          ? "CHANNELS"
          : canManageTeam && !teamVisited
            ? "TEAM"
            : !faqAdded
              ? "FAQ"
              : "INBOX",
  }
}
