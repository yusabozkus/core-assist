"use client"

import { useState } from "react"
import {
  ArrowUpRight01Icon,
  CreditCardIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { createBillingPortalSession } from "@/lib/api/billing"
import { markBillingPortalVisit } from "@/lib/billing-portal-return"
import type { BillingHistory, BillingPaymentMethod } from "@/types/billing"

export function BillingPaymentDetails({
  workspaceId,
  managedByPaddle,
  history,
}: {
  workspaceId: string
  managedByPaddle: boolean
  history: BillingHistory | null
}) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paymentMethod = history?.paymentMethod ?? null
  const customer = history?.billingCustomer ?? null

  async function openPaymentSettings() {
    setIsOpeningPortal(true)
    setError(null)
    try {
      const session = await createBillingPortalSession(workspaceId)
      markBillingPortalVisit(workspaceId)
      window.location.assign(
        session.updatePaymentMethodUrl ?? session.overviewUrl
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ödeme yönetimi şu anda açılamıyor."
      )
      setIsOpeningPortal(false)
    }
  }

  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card">
      <section className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Ödeme yöntemi</h2>

        {paymentMethod ? (
          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-10 min-w-14 shrink-0 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-bold tracking-tight uppercase">
              {paymentMethod.brand ?? paymentMethod.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {paymentMethodLabel(paymentMethod)}
              </p>
              {paymentMethodExpiry(paymentMethod) ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Son kullanma {paymentMethodExpiry(paymentMethod)}
                </p>
              ) : null}
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              Varsayılan
            </span>
          </div>
        ) : (
          <div className="mt-5 flex gap-3 rounded-lg border border-dashed border-border p-4">
            <HugeiconsIcon
              icon={CreditCardIcon}
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div>
              <p className="text-xs font-medium">
                {managedByPaddle
                  ? "Ödeme yöntemi henüz görüntülenemiyor"
                  : "Kayıtlı ödeme yöntemi yok"}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {managedByPaddle
                  ? "İlk başarılı ödeme sonrasında kullanılan yöntem burada gösterilir."
                  : "Bir plan seçtiğinizde ödeme bilgileri güvenli biçimde Paddle üzerinden alınır."}
              </p>
            </div>
          </div>
        )}

        {managedByPaddle ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5 w-full"
            disabled={isOpeningPortal}
            onClick={openPaymentSettings}
          >
            <HugeiconsIcon
              icon={isOpeningPortal ? Loading03Icon : ArrowUpRight01Icon}
              className={isOpeningPortal ? "size-3.5 animate-spin" : "size-3.5"}
            />
            {isOpeningPortal ? "Paddle açılıyor" : "Ödeme yöntemini yönet"}
          </Button>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs leading-5 text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <section className="border-t border-border p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Fatura bilgileri</h2>
        {customer ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm leading-6 font-medium">
              {customer.name ?? "Bireysel müşteri"}
            </p>
            {customer.email ? (
              <p className="text-xs text-muted-foreground">{customer.email}</p>
            ) : null}
            {customer.address ? (
              <p className="text-xs leading-6 text-muted-foreground">
                {customer.address}
              </p>
            ) : null}
            {customer.taxIdentifier ? (
              <dl className="flex justify-between gap-3 pt-2 text-xs">
                <dt className="text-muted-foreground">Vergi numarası</dt>
                <dd className="tabular-nums">{customer.taxIdentifier}</dd>
              </dl>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Fatura bilgileri başarılı ödemenizin ardından Paddle kayıtlarından
            burada gösterilir.
          </p>
        )}
      </section>
    </aside>
  )
}

function paymentMethodLabel(method: BillingPaymentMethod) {
  if (method.type === "card" && method.last4) return `•••• ${method.last4}`
  return paymentProviderLabel(method.type)
}

function paymentMethodExpiry(method: BillingPaymentMethod) {
  if (!method.expiryMonth || !method.expiryYear) return null
  return `${String(method.expiryMonth).padStart(2, "0")}/${String(method.expiryYear).slice(-2)}`
}

function paymentProviderLabel(type: string) {
  const labels: Record<string, string> = {
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    paypal: "PayPal",
    card: "Kart",
  }
  return labels[type] ?? type
}
