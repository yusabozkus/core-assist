export type AdminSearchResponse = {
  query: string
  accounts: Array<{
    id: string
    name: string
    ownerName: string
    ownerEmail: string
    matchedMember: { name: string; email: string } | null
    storeCount: number
  }>
  stores: Array<{
    id: string
    name: string
    status: "ACTIVE" | "INACTIVE"
    workspaceId: string
    workspaceName: string
    ownerEmail: string
  }>
  tickets: Array<{
    id: string
    code: string
    subject: string
    status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED"
    workspaceId: string
    workspaceName: string
    storeName: string | null
  }>
  syncRuns: Array<{
    id: string
    kind: "FULL" | "INVENTORY" | "QUESTION"
    status: "RUNNING" | "COMPLETED" | "FAILED"
    providerKey: string
    storeName: string
    workspaceId: string
    workspaceName: string
    startedAt: string
  }>
  paddleRecords: Array<{
    id: string
    kind: "CUSTOMER" | "SUBSCRIPTION" | "TRANSACTION" | "PRICE"
    reference: string
    workspaceId: string
    workspaceName: string
    ownerEmail: string
    plan: string | null
    status: string
    updatedAt: string
  }>
}
