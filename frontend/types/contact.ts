export type ContactMessageTopic =
  "PRODUCT" | "PRICING" | "PARTNERSHIP" | "OTHER"

export type ContactMessageStatus = "NEW" | "READ" | "ARCHIVED"

export type CreateContactMessageInput = {
  name: string
  email: string
  company?: string
  topic: ContactMessageTopic
  subject: string
  message: string
  sourcePage?: string
  website?: string
}

export type AdminContactMessage = {
  id: string
  name: string
  email: string
  company: string | null
  topic: ContactMessageTopic
  subject: string
  message: string
  status: ContactMessageStatus
  sourcePage: string | null
  readAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminContactMessageQuery = {
  q?: string
  status?: ContactMessageStatus
  topic?: ContactMessageTopic
  page?: number
  pageSize?: number
}

export type AdminContactMessageList = {
  items: AdminContactMessage[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: {
    new: number
    read: number
    archived: number
  }
}
