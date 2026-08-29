export type StoreStatus = "ACTIVE" | "INACTIVE"

export type StoreSummary = {
  id: string
  name: string
  status: StoreStatus
  createdAt: string
}
