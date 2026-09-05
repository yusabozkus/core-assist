import type { ProductQuestionStatus } from "@/types/question"

export type GlobalProductSearchResult = {
  id: string
  title: string
  brand: string | null
  category: string | null
  imageUrl: string | null
  matchedIdentifier: string | null
}

export type GlobalQuestionSearchResult = {
  id: string
  question: string
  customerName: string | null
  productTitle: string | null
  providerKey: string
  status: ProductQuestionStatus
  externalCreatedAt: string
}

export type GlobalSearchResponse = {
  query: string
  products: GlobalProductSearchResult[]
  questions: GlobalQuestionSearchResult[]
  hasMoreProducts: boolean
  hasMoreQuestions: boolean
}
