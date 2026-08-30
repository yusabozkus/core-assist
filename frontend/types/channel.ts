export type ChannelType = "COMMERCE" | "MESSAGING" | "SOCIAL"
export type IntegrationEnvironment = "SANDBOX" | "PRODUCTION"

export type ChannelConnectionStatus =
  "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR"

export type ChannelConnection = {
  id: string
  providerKey: string
  type: ChannelType
  environment: IntegrationEnvironment
  status: ChannelConnectionStatus
  connectedAt: string | null
  processingStartedAt: string | null
  lastSyncAt: string | null
  lastInventorySyncAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export type CredentialFieldDefinition = {
  key: string
  label: string
  type: "text" | "password"
  placeholder: string
}

export type IntegrationProvider = {
  key: string
  name: string
  type: "COMMERCE"
  image: string
  description: string
  capabilities: Array<
    "CATALOG_READ" | "INVENTORY_READ" | "PRODUCT_QNA_READ" | "PRODUCT_QNA_REPLY"
  >
  environments: IntegrationEnvironment[]
  credentialFields: CredentialFieldDefinition[]
}

export type CatalogSyncResult = {
  syncRunId: string
  status: "RUNNING"
  queuedAt: string
  kind: "FULL" | "INVENTORY"
}
