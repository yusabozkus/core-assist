export type ChannelProvider =
  "TRENDYOL" | "HEPSIBURADA" | "INSTAGRAM" | "WHATSAPP" | "WOOCOMMERCE"

export type ChannelType = "COMMERCE" | "MESSAGING" | "SOCIAL"

export type ChannelConnectionStatus =
  "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"

export type ChannelConnection = {
  id: string
  provider: ChannelProvider
  type: ChannelType
  status: ChannelConnectionStatus
  connectedAt: string | null
  lastSyncAt: string | null
  createdAt: string
  updatedAt: string
}
