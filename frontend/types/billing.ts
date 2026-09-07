export type BillingCycle = "monthly" | "annual"

export type SubscriptionPlan = {
  id: "starter" | "growth" | "business"
  name: string
  description: string
  monthlyPrice: number
  questions: number
  stores: number
  connections: number | null
  products: number
  features: readonly string[]
  highlighted?: boolean
}

export type InvoiceStatus = "paid" | "refunded"

export type InvoiceRecord = {
  id: string
  number: string
  plan: string
  period: string
  issuedAt: string
  year: string
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  paymentMethod: string
}
