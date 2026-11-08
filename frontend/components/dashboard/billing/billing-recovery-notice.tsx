"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PaymentMethodDialog } from "@/components/dashboard/billing/payment-method-dialog"
import {
  getBillingSummary,
  refreshBillingSubscription,
} from "@/lib/api/billing"
import {
  clearBillingPortalReturn,
  hasPendingBillingPortalReturn,
} from "@/lib/billing-portal-return"
import type { BillingSummary } from "@/types/billing"

export function BillingRecoveryNotice({
  workspaceId,
  subscription,
}: {
  workspaceId: string
  subscription: BillingSummary["subscription"]
}) {
  const router = useRouter()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const recovery = subscription.recovery
  const awaiting = recovery?.awaitingRenewal
  const paymentIssue = recovery?.paymentIssue
  const delayed = recovery?.checkDelayed
  const checkoutPending = recovery?.checkoutPending

  useEffect(() => {
    if (!subscription.managedByPaddle && !checkoutPending) return
    const controller = new AbortController()
    let checking = false
    async function check() {
      if (checking || document.visibilityState !== "visible") return
      checking = true
      try {
        if (hasPendingBillingPortalReturn(workspaceId)) {
          await refreshBillingSubscription(workspaceId, controller.signal)
          clearBillingPortalReturn(workspaceId)
        }
        const next = (await getBillingSummary(workspaceId, controller.signal))
          .subscription
        if (
          next.active !== subscription.active ||
          next.status !== subscription.status ||
          next.currentPeriodEnd !== subscription.currentPeriodEnd ||
          next.cancelAtPeriodEnd !== subscription.cancelAtPeriodEnd ||
          next.scheduledAccessEndsAt !== subscription.scheduledAccessEndsAt ||
          next.managedByPaddle !== subscription.managedByPaddle ||
          next.recovery?.checkoutPending !== checkoutPending ||
          next.recovery?.awaitingRenewal !== awaiting ||
          next.recovery?.checkDelayed !== delayed
        )
          router.refresh()
      } catch {
        /* Keep the last confirmed server state; never claim payment succeeded. */
      } finally {
        checking = false
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 30_000)
    document.addEventListener("visibilitychange", check)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
    }
  }, [
    workspaceId,
    subscription.managedByPaddle,
    subscription.active,
    subscription.status,
    subscription.currentPeriodEnd,
    subscription.cancelAtPeriodEnd,
    subscription.scheduledAccessEndsAt,
    awaiting,
    delayed,
    checkoutPending,
    router,
  ])

  // Pending first-purchase checkouts are reconciled silently. They are not an
  // account problem and should not interrupt the billing overview.
  if (!awaiting && !paymentIssue && !delayed) return null

  return (
    <section
      role="status"
      className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4"
    >
      <h2 className="text-sm font-medium">
        {paymentIssue
          ? "Yenileme ödemeniz tamamlanamadı"
          : awaiting
            ? "Yenileme doğrulanıyor"
            : "Abonelik kontrolü gecikti"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {paymentIssue
          ? "Ödeme yönteminizi kontrol edin. Paddle güncel ödeme durumunu doğruladığında erişiminiz otomatik açılacak. Bu sırada mevcut soruları manuel yanıtlayabilirsiniz."
          : awaiting
            ? "Paddle'dan yeni dönem bilgisi bekleniyor. Hizmetiniz en fazla 30 dakikalık kontrol süresince açık kalır; bu süre yeni bir soru kotası oluşturmaz. Tekrar satın almanız gerekmez."
            : "Paddle ile otomatik durum kontrolü şu anda tamamlanamıyor. Sistem tekrar deneyecek; ödeme alındıysa yeniden satın almayın."}
      </p>
      {paymentIssue && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setPaymentOpen(true)}
        >
          Ödeme yöntemini güncelle
        </Button>
      )}
      <PaymentMethodDialog
        workspaceId={workspaceId}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </section>
  )
}
