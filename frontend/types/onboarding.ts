import type { AiEmojiPolicy, AiResponseLength, AiTone } from "@/types/knowledge"

export type OnboardingChannel = "TRENDYOL" | "HEPSIBURADA"
export type InventoryPolicy = "SHARED" | "CHANNEL_SPECIFIC"

export type OnboardingStage =
  "STORE" | "CHANNEL" | "SYNCING" | "PREFERENCES" | "COMPLETED"

export type ProvisionOnboardingPayload = {
  storeName: string
  selectedChannel: OnboardingChannel
  inventoryPolicy: InventoryPolicy
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
  inventoryPolicy: InventoryPolicy
  tone: AiTone
  responseLength: AiResponseLength
}

export type OnboardingResource = {
  id: string
  name: string
  inventoryPolicy?: InventoryPolicy | null
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
  catalogSync: {
    syncRunId: string
    connectionId: string
    providerKey: string
    status: "RUNNING" | "COMPLETED" | "FAILED"
    stage:
      | "QUEUED"
      | "FETCHING"
      | "PERSISTING"
      | "RECONCILING"
      | "COMPLETED"
      | "FAILED"
    progress: number
    productsProcessed: number
    productsSkipped: number
    errorMessage: string | null
  } | null
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
  nextStep: "CATALOG_SYNC"
}

export type CompleteOnboardingResponse = {
  completed: true
  completedAt: string
  store: OnboardingResource
  nextPath: string
}
