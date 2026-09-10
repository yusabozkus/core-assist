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
  const router = useRouter()
  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    async function poll() {
      try {
        const result = await getBillingPlanChange(
          workspaceId,
          change.id,
          abort.signal
        )
        if (abort.signal.aborted) return
        if (result.status === "COMPLETED" || result.status === "FAILED") {
          router.refresh()
          return
        }
      } catch {
        if (abort.signal.aborted) return
      }
      if (++attempts < 30) timer = setTimeout(() => void poll(), 2000)
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
          <p className="text-sm font-medium">Plan değişikliği bekleniyor</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {getBillingPlanName(change.plan)} ·{" "}
            {change.cycle === "ANNUAL" ? "Yıllık" : "Aylık"}. Paddle doğrulaması
            gelene kadar yeni bir işlem başlatılmaz.
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
