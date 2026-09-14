export type StoreStatus = "ACTIVE" | "INACTIVE"

export type StoreAccessLevel =
  | "OWNER"
  | "ACCOUNT_ADMIN"
  | "STORE_ADMIN"
  | "AGENT"
  | "VIEWER"

export type StoreSummary = {
  id: string
  name: string
  status: StoreStatus
  createdAt: string
  accessLevel?: StoreAccessLevel
}
