export type ProductQuestionStatus =
  "PENDING" | "DRAFTED" | "ANSWERED" | "IGNORED"

export type ProductQuestion = {
  id: string
  externalQuestionId: string
  externalProductId: string
  customerName: string | null
  question: string
  status: ProductQuestionStatus
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
}

export type QuestionSyncResult = {
  status: "RUNNING"
  queued: number
  skipped: number
}
