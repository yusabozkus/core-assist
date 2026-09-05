import type { AiEmojiPolicy, AiResponseLength, AiTone } from "@/types/knowledge"

export type OnboardingChannel = "TRENDYOL" | "HEPSIBURADA"

export type OnboardingStage = "STORE" | "CHANNEL" | "PREFERENCES" | "COMPLETED"

export type ProvisionOnboardingPayload = {
  storeName: string
  selectedChannel: OnboardingChannel
  environment?: "SANDBOX" | "PRODUCTION"
  credentials?: Record<string, string>
  brandDescription?: string
  tone?: AiTone
  responseLength?: AiResponseLength
  greetingEnabled?: boolean
  closingEnabled?: boolean
  emojiPolicy?: AiEmojiPolicy
  preferredEmoji?: string | null
}

export type CompleteOnboardingPayload = {
  storeId: string
  tone: AiTone
  responseLength: AiResponseLength
}

export type OnboardingResource = {
  id: string
  name: string
}

export type ChannelConnection = {
  id: string
  providerKey: string
  type: "COMMERCE" | "MESSAGING" | "SOCIAL"
  status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"
}

export type OnboardingStatus = {
  completed: boolean
  completedAt: string | null
  stage: OnboardingStage
  store: OnboardingResource | null
  profile: {
    brandDescription: string | null
    tone: AiTone
    responseLength: AiResponseLength
  } | null
  channelConnections: ChannelConnection[]
}

export type ProvisionOnboardingResponse = {
  completed: false
  created: {
    store: boolean
  }
  store: OnboardingResource
  channelConnection: ChannelConnection
  catalogSync: {
    syncRunId: string
    status: "RUNNING"
    queuedAt: string
    kind: "FULL" | "INVENTORY"
  }
  nextStep: "PREFERENCES"
}

export type CompleteOnboardingResponse = {
  completed: true
  completedAt: string
  store: OnboardingResource
  nextPath: string
}
