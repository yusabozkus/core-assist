export type AiTone = "PROFESSIONAL" | "FRIENDLY" | "WARM" | "MINIMAL"
export type AiResponseLength = "SHORT" | "BALANCED" | "DETAILED"
export type AiEmojiPolicy = "NEVER" | "WHEN_APPROPRIATE" | "ALWAYS"
export type AiAutomationMode = "OFF" | "SHADOW" | "SAFE_AUTO"

export type KnowledgeFaq = {
  question: string
  answer: string
  active: boolean
}

export type AiInstruction = {
  content: string
  priority: number
  active: boolean
}

export type ChannelKnowledgeOverride = {
  providerKey: string
  shippingPolicy: string | null
  returnPolicy: string | null
  exchangePolicy: string | null
  warrantyPolicy: string | null
  additionalInformation: string | null
}

export type StoreKnowledge = {
  profile: {
    automationMode: AiAutomationMode
    minimumAutoSendConfidence: number
    brandDescription: string | null
    shippingPolicy: string | null
    returnPolicy: string | null
    exchangePolicy: string | null
    warrantyPolicy: string | null
    additionalInformation: string | null
    tone: AiTone
    responseLength: AiResponseLength
    greetingEnabled: boolean
    closingEnabled: boolean
    heightWeightSizeRecommendationEnabled: boolean
    emojiPolicy: AiEmojiPolicy
    preferredEmoji: string | null
  }
  faqs: KnowledgeFaq[]
  instructions: AiInstruction[]
  channelOverrides: ChannelKnowledgeOverride[]
  providers: Array<{ providerKey: string; status: string }>
}

export type UpdateStoreKnowledgePayload = Partial<StoreKnowledge["profile"]> & {
  faqs?: KnowledgeFaq[]
  instructions?: AiInstruction[]
  channelOverrides?: ChannelKnowledgeOverride[]
}
