export type StoreStatus = "ACTIVE" | "INACTIVE"
export type InventoryPolicy = "SHARED" | "CHANNEL_SPECIFIC"

export type StoreAccessLevel =
  "OWNER" | "ACCOUNT_ADMIN" | "STORE_ADMIN" | "AGENT" | "VIEWER"

export type StoreSummary = {
  id: string
  name: string
  inventoryPolicy: InventoryPolicy | null
  status: StoreStatus
  createdAt: string
  accessLevel?: StoreAccessLevel
}
