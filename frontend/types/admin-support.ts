import type {
  SupportMessageAuthorType,
  SupportTicketCategory,
  SupportTicketImpact,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportAttachment,
} from "@/types/support"

export type AdminSupportPerson = {
  id: string
  name: string
  email: string
  image: string | null
}

export type AdminSupportTicketSummary = {
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
  workspace: { id: string; name: string }
  store: { id: string; name: string } | null
  createdBy: AdminSupportPerson | null
  assignedAdmin: AdminSupportPerson | null
  messageCount: number
  lastMessage: {
    body: string
    authorType: SupportMessageAuthorType
    isInternal: boolean
    createdAt: string
  } | null
}

export type AdminSupportMessage = {
  id: string
  authorType: SupportMessageAuthorType
  isInternal: boolean
  body: string
  attachments: SupportAttachment[]
  createdAt: string
  author: AdminSupportPerson | null
}

export type AdminSupportTicketDetail = AdminSupportTicketSummary & {
  context: {
    pagePath: string | null
    userAgent: string | null
  } | null
  resolvedAt: string | null
  closedAt: string | null
  messages: AdminSupportMessage[]
}

export type AdminSupportTicketList = {
  items: AdminSupportTicketSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    active: number
    unassigned: number
    urgent: number
    overdue: number
  }
}

export type AdminSupportTicketQuery = {
  q?: string
  status?: SupportTicketStatus
  priority?: SupportTicketPriority
  category?: SupportTicketCategory
  assignee?: "ME" | "UNASSIGNED"
  sort?: "LAST_ACTIVITY" | "OLDEST" | "SLA"
  page?: number
  pageSize?: number
}
