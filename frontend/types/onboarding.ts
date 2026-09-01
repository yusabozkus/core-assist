import type { AiEmojiPolicy, AiResponseLength, AiTone } from "@/types/knowledge"

export type OnboardingChannel = "TRENDYOL" | "HEPSIBURADA"

export type CompleteOnboardingPayload = {
  storeName: string
  selectedChannel?: OnboardingChannel
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

type OnboardingResource = {
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
  store: OnboardingResource | null
  channelConnections: ChannelConnection[]
}

export type CompleteOnboardingResponse = {
  completed: true
  created: {
    store: boolean
  }
  store: OnboardingResource
  channelConnection: ChannelConnection | null
  catalogSync: {
    syncRunId: string
    status: "RUNNING"
    queuedAt: string
    kind: "FULL" | "INVENTORY"
  } | null
  nextPath: string
}
