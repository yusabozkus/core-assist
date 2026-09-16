export type SupportTicketCategory =
  | "CHANNELS"
  | "AI_AUTOMATION"
  | "CATALOG_INVENTORY"
  | "BILLING_ACCOUNT"
  | "TEAM_ACCESS"
  | "OTHER"

export type SupportTicketImpact = "QUESTION" | "PARTIAL" | "BLOCKED"
export type SupportTicketPriority = "NORMAL" | "HIGH" | "URGENT"
export type SupportTicketStatus =
  "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED"

export type SupportMessageAuthorType = "CUSTOMER" | "SUPPORT" | "SYSTEM"

export type SupportTicketPerson = {
  id: string
  name: string
  image: string | null
}

export type SupportTicketSummary = {
  id: string
  number: number
  code: string
  category: SupportTicketCategory
  impact: SupportTicketImpact
  priority: SupportTicketPriority
  status: SupportTicketStatus
  subject: string
  planSnapshot: "STARTER" | "GROWTH" | "BUSINESS"
  firstResponseDueAt: string
  firstRespondedAt: string | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  createdBy: SupportTicketPerson | null
  messageCount: number
  lastMessage: {
    body: string
    authorType: SupportMessageAuthorType
    createdAt: string
  } | null
}

export type SupportMessage = {
  id: string
  authorType: SupportMessageAuthorType
  body: string
  createdAt: string
  author: SupportTicketPerson | null
}

export type SupportTicketDetail = SupportTicketSummary & {
  store: { id: string; name: string } | null
  messages: SupportMessage[]
}

export type SupportTicketList = {
  items: SupportTicketSummary[]
  counts: Record<SupportTicketStatus, number>
  total: number
}

export type CreateSupportTicketInput = {
  category: SupportTicketCategory
  impact: SupportTicketImpact
  subject: string
  message: string
  pagePath?: string
}
