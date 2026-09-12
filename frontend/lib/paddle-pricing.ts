"use client"

import { useCallback, useEffect, useState } from "react"
import type { PricePreviewResponse } from "@paddle/paddle-js"
import { getBillingPricingConfig } from "@/lib/api/billing"
import { formatCurrency } from "@/lib/format-currency"
import { getPaddle } from "@/lib/paddle"
import type {
  BillingCycle,
  BillingPlanId,
  BillingPlanPrice,
  BillingPlanPrices,
  BillingPricingConfig,
} from "@/types/billing"

const PLAN_IDS: BillingPlanId[] = ["starter", "growth", "business"]
const BILLING_CYCLES: BillingCycle[] = ["monthly", "annual"]

let cachedPrices: BillingPlanPrices | null = null
let pricingPromise: Promise<BillingPlanPrices> | null = null

export function usePaddlePricing() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{
    prices: BillingPlanPrices | null
    loading: boolean
    error: string | null
  }>(() => ({ prices: cachedPrices, loading: !cachedPrices, error: null }))

  useEffect(() => {
    let active = true
    void loadPaddlePricing()
      .then((prices) => {
        if (active) setState({ prices, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          prices: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Güncel plan fiyatları alınamadı.",
        })
      })
    return () => {
      active = false
    }
  }, [revision])

  const retry = useCallback(() => {
    cachedPrices = null
    pricingPromise = null
    setState({ prices: null, loading: true, error: null })
    setRevision((value) => value + 1)
  }, [])

  return { ...state, retry }
}

export function commonAnnualDiscount(prices: BillingPlanPrices | null) {
  if (!prices) return null
  const discounts = PLAN_IDS.map(
    (planId) => prices[planId].annual.discountPercentage
  )
  const first = discounts[0]
  return first && discounts.every((discount) => discount === first)
    ? first
    : null
}

function loadPaddlePricing() {
  if (cachedPrices) return Promise.resolve(cachedPrices)
  if (pricingPromise) return pricingPromise

  pricingPromise = Promise.all([getBillingPricingConfig(), getPaddle()])
    .then(async ([config, paddle]) => {
      assertMatchingEnvironment(config)
      const response = await paddle.PricePreview({
        items: config.items.map((item) => ({
          priceId: item.priceId,
          quantity: 1,
        })),
      })
      const prices = normalizePricing(config, response)
      cachedPrices = prices
      return prices
    })
    .catch((error: unknown) => {
      pricingPromise = null
      throw error
    })

  return pricingPromise
}

function normalizePricing(
  config: BillingPricingConfig,
  response: PricePreviewResponse
): BillingPlanPrices {
  if (config.items.length !== PLAN_IDS.length * BILLING_CYCLES.length) {
    throw new Error("Plan fiyat kataloğu eksik yapılandırılmış.")
  }
  if (
    new Set(config.items.map((item) => item.priceId)).size !==
    config.items.length
  ) {
    throw new Error("Plan fiyat kataloğunda yinelenen fiyatlar var.")
  }

  const lineItems = new Map(
    response.data.details.lineItems.map((item) => [item.price.id, item])
  )
  const configured = new Map(
    config.items.map((item) => [
      `${item.plan.toLowerCase()}:${item.cycle.toLowerCase()}`,
      item.priceId,
    ])
  )
  const result = {} as BillingPlanPrices

  for (const planId of PLAN_IDS) {
    const monthly = previewAmount(
      configuredPrice(configured, planId, "monthly"),
      "monthly",
      lineItems
    )
    const annual = previewAmount(
      configuredPrice(configured, planId, "annual"),
      "annual",
      lineItems
    )
    if (monthly.currencyCode !== annual.currencyCode) {
      throw new Error("Aylık ve yıllık plan para birimleri eşleşmiyor.")
    }

    const annualSaving = monthly.amount * 12 - annual.amount
    const discountPercentage =
      annualSaving > 0
        ? Math.round((annualSaving / (monthly.amount * 12)) * 1000) / 10
        : null

    result[planId] = {
      monthly: displayPrice(monthly, monthly.amount, null, null),
      annual: displayPrice(
        annual,
        annual.amount / 12,
        annualSaving > 0
          ? formatCurrency(annualSaving, annual.currencyCode, {
              maximumFractionDigits: 2,
            })
          : null,
        discountPercentage
      ),
    }
  }

  return result
}

function previewAmount(
  priceId: string,
  cycle: BillingCycle,
  lineItems: Map<
    string,
    PricePreviewResponse["data"]["details"]["lineItems"][number]
  >
) {
  const item = lineItems.get(priceId)
  const expectedInterval = cycle === "monthly" ? "month" : "year"
  if (
    !item ||
    item.quantity !== 1 ||
    item.price.billingCycle?.frequency !== 1 ||
    item.price.billingCycle.interval !== expectedInterval ||
    item.price.trialPeriod !== null ||
    !/^\d+$/.test(item.price.unitPrice.amount)
  ) {
    throw new Error(
      "Paddle plan fiyatı doğrulanamadı. Ücretli plan fiyatlarında deneme süresi bulunmamalıdır."
    )
  }
  // Marketing surfaces show the catalog price before tax. Paddle Checkout
  // remains authoritative for location-specific tax and the payable total.
  const minorAmount = Number(item.price.unitPrice.amount)
  if (!Number.isSafeInteger(minorAmount)) {
    throw new Error("Paddle plan tutarı güvenli aralığın dışında.")
  }
  const currencyCode = item.price.unitPrice.currencyCode
  const fractionDigits =
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits ?? 2

  return {
    priceId,
    currencyCode,
    amount: minorAmount / 10 ** fractionDigits,
  }
}

function displayPrice(
  source: { priceId: string; currencyCode: string; amount: number },
  monthlyAmount: number,
  saving: string | null,
  discountPercentage: number | null
): BillingPlanPrice {
  return {
    priceId: source.priceId,
    currencyCode: source.currencyCode,
    monthly: formatCurrency(monthlyAmount, source.currencyCode, {
      maximumFractionDigits: 2,
    }),
    total: formatCurrency(source.amount, source.currencyCode, {
      maximumFractionDigits: 2,
    }),
    saving,
    discountPercentage,
  }
}

function configuredPrice(
  configured: Map<string, string>,
  planId: BillingPlanId,
  cycle: BillingCycle
) {
  const priceId = configured.get(`${planId}:${cycle}`)
  if (!priceId) throw new Error("Plan fiyat kataloğu eksik yapılandırılmış.")
  return priceId
}

function assertMatchingEnvironment(config: BillingPricingConfig) {
  const clientEnvironment =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? "production"
      : "sandbox"
  if (config.environment !== clientEnvironment) {
    throw new Error("Paddle fiyat ortamı ödeme ortamıyla eşleşmiyor.")
  }
}
