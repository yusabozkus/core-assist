"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PlanChangeDialog } from "@/components/dashboard/billing/plan-change-dialog"
import { getBillingPlanChange } from "@/lib/api/billing"
import { getBillingPlanName } from "@/lib/billing"
import type {
  BillingCycle,
  BillingPlanId,
  BillingPlanChangeResult,
  BillingSummary,
} from "@/types/billing"

export function PendingPlanChange({
  workspaceId,
  change,
}: {
  workspaceId: string
  change: NonNullable<BillingSummary["pendingPlanChange"]>
}) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(change)
  const router = useRouter()
  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const result = await getBillingPlanChange(
          workspaceId,
          change.id,
          abort.signal
        )
        if (abort.signal.aborted) return
        setCurrent(result)
        if (result.status === "COMPLETED" || result.status === "FAILED") {
          router.refresh()
          return
        }
        timer = setTimeout(() => void poll(), nextPlanChangePollDelay(result))
      } catch {
        if (abort.signal.aborted) return
        timer = setTimeout(() => void poll(), 5000)
      }
    }
    void poll()
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [workspaceId, change.id, router])

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4"
      >
        <div>
          <p className="text-sm font-medium">
            {current.status === "RETRY_SCHEDULED"
              ? "Plan değişikliği yeniden denenecek"
              : "Plan değişikliği bekleniyor"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {getBillingPlanName(current.plan)} ·{" "}
            {current.cycle === "ANNUAL" ? "Yıllık" : "Aylık"}.{" "}
            {current.status === "RETRY_SCHEDULED"
              ? `${formatRetryAt(current.retryAt)} sonra otomatik olarak tekrar denenecek.`
              : "Paddle doğrulaması gelene kadar yeni bir işlem başlatılmaz."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Durumu görüntüle
        </Button>
      </div>
      <PlanChangeDialog
        workspaceId={workspaceId}
        plan={change.plan.toLowerCase() as BillingPlanId}
        cycle={change.cycle.toLowerCase() as BillingCycle}
        pendingId={change.id}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function nextPlanChangePollDelay(result: BillingPlanChangeResult) {
  if (result.status !== "RETRY_SCHEDULED" || !result.retryAt) return 2000
  return Math.min(
    60_000,
    Math.max(2000, Date.parse(result.retryAt) - Date.now() + 1000)
  )
}

function formatRetryAt(value?: string | null) {
  if (!value) return "Belirlenen zamandan"
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
