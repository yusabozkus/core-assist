export type OnboardingChannel = "TRENDYOL" | "HEPSIBURADA"

export type CompleteOnboardingPayload = {
  storeName: string
  selectedChannel?: OnboardingChannel
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
  nextPath: string
}
