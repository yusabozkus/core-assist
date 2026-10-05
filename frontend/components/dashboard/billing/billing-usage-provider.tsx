"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { getStoreBillingUsage } from "@/lib/api/billing"
import type { StoreBillingUsageOverview } from "@/types/billing"

type BillingUsageContextValue = {
  usage: StoreBillingUsageOverview | null
  refresh: () => Promise<void>
}

const BillingUsageContext = createContext<BillingUsageContextValue | null>(null)
const REFRESH_INTERVAL_MS = 30_000

export function BillingUsageProvider({
  storeId,
  initialUsage,
  children,
}: {
  storeId: string | null
  initialUsage: StoreBillingUsageOverview | null
  children: React.ReactNode
}) {
  const [usage, setUsage] = useState(initialUsage)
  const requestRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!storeId || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller

    try {
      const nextUsage = await getStoreBillingUsage(
        storeId,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
      )
      if (!controller.signal.aborted) setUsage(nextUsage)
    } catch {
      // Keep the last known usage when the lightweight refresh is unavailable.
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [storeId])

  useEffect(() => {
    if (!storeId) return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, REFRESH_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    const handleBillingUpdate = () => void refresh()
    window.addEventListener("billing-updated", handleBillingUpdate)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("billing-updated", handleBillingUpdate)
      requestRef.current?.abort()
    }
  }, [refresh, storeId])

  const value = useMemo(() => ({ usage, refresh }), [refresh, usage])

  return (
    <BillingUsageContext.Provider value={value}>
      {children}
    </BillingUsageContext.Provider>
  )
}

export function useBillingUsage() {
  const context = useContext(BillingUsageContext)
  if (!context) {
    throw new Error("useBillingUsage must be used within BillingUsageProvider.")
  }
  return context
}
