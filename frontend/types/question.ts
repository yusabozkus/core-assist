export type ProductQuestionStatus =
  "PENDING" | "DRAFTED" | "ANSWERED" | "IGNORED"

export type QuestionAnswerStatus = "QUEUED" | "PROCESSING" | "SENT" | "FAILED"

export type QuestionAnswerDelivery = {
  id: string
  answer: string
  status: QuestionAnswerStatus
  attempts: number
  lastError: string | null
  queuedAt: string
  sentAt: string | null
}

export type ProductQuestion = {
  id: string
  externalQuestionId: string
  externalProductId: string
  customerName: string | null
  question: string
  status: ProductQuestionStatus
  answer: string | null
  answeredAt: string | null
  externalCreatedAt: string
  createdAt: string
  connection: {
    providerKey: string
  }
  product: {
    id: string
    title: string
    brand: string | null
    category: string | null
    images: Array<{ url: string }>
  } | null
  answerDelivery: QuestionAnswerDelivery | null
}

export type QuestionSyncResult = {
  status: "RUNNING"
  queued: number
  skipped: number
}

export type QueueQuestionAnswerResult = {
  id: string
  status: "QUEUED"
  queuedAt: string
}
