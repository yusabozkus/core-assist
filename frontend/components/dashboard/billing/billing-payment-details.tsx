"use client"

import { useCallback, useState } from "react"
import { CreditCardIcon, Shield01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { PaymentMethodDialog } from "@/components/dashboard/billing/payment-method-dialog"
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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [updatedMethod, setUpdatedMethod] = useState<{
    workspaceId: string
    method: BillingPaymentMethod | null
  } | null>(null)
  const handleUpdated = useCallback(
    (method: BillingPaymentMethod | null) => {
      setUpdatedMethod({ workspaceId, method })
    },
    [workspaceId]
  )
  const paymentMethod =
    updatedMethod?.workspaceId === workspaceId
      ? updatedMethod.method
      : (history?.paymentMethod ?? null)
  const customer = history?.billingCustomer ?? null
  const expiry = paymentMethod ? paymentMethodExpiry(paymentMethod) : null

  return (
    <aside
      aria-labelledby="payment-management-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <section className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="payment-management-title" className="text-sm font-semibold">
            Ödeme yönetimi
          </h2>
          <span className="text-xs text-muted-foreground">Paddle</span>
        </div>

        {paymentMethod ? (
          <div className="relative isolate mt-5 overflow-hidden rounded-xl border border-border bg-linear-to-br from-muted via-muted/40 to-background p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-16 -z-10 size-64 rounded-full border border-foreground/5"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-8 -z-10 size-48 rounded-full border border-foreground/5"
            />
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm font-semibold tracking-tight wrap-break-word">
                {paymentMethodBrandLabel(paymentMethod)}
              </span>
              <HugeiconsIcon
                icon={CreditCardIcon}
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
            </div>

            <div className="mt-7">
              {paymentMethod.last4 ? (
                <p>
                  <span className="sr-only">
                    Son dört hanesi {paymentMethod.last4} olan kart
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-base tracking-[0.08em] tabular-nums sm:text-lg"
                  >
                    <span className="text-muted-foreground">
                      •••• •••• ••••
                    </span>
                    <span className="font-semibold">{paymentMethod.last4}</span>
                  </span>
                </p>
              ) : (
                <p className="text-lg font-medium tracking-tight">
                  {paymentProviderLabel(paymentMethod.type)}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <p className="text-[11px] text-muted-foreground">
                Son kullanılan
              </p>
              {expiry ? (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">
                    Son kullanma
                  </p>
                  <p className="mt-1 font-mono text-xs font-medium tabular-nums">
                    {expiry}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/20 p-5">
            <span className="mb-4 flex size-9 items-center justify-center rounded-lg border border-border bg-background">
              <HugeiconsIcon
                icon={CreditCardIcon}
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            </span>
            <p className="text-sm font-medium">
              {managedByPaddle
                ? "Ödeme yöntemi henüz görüntülenemiyor"
                : "Kayıtlı ödeme yöntemi yok"}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {managedByPaddle
                ? history === null
                  ? "Ödeme bilgileri şu anda alınamadı. Daha sonra yeniden deneyebilirsiniz."
                  : "İlk başarılı ödeme sonrasında kullanılan yöntem burada gösterilir."
                : "Bir plan seçtiğinizde ödeme bilgileri Paddle üzerinden alınır."}
            </p>
          </div>
        )}

        {managedByPaddle ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 w-full justify-between"
            onClick={() => setPaymentOpen(true)}
          >
            Ödeme yöntemini yönet
            <HugeiconsIcon
              icon={CreditCardIcon}
              aria-hidden="true"
              className="size-3.5"
            />
          </Button>
        ) : null}

        <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <HugeiconsIcon
            icon={Shield01Icon}
            aria-hidden="true"
            className="size-3.5 shrink-0"
          />
          Ödeme bilgileri Paddle üzerinden yönetilir.
        </p>
      </section>

      <section className="border-t border-border p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Fatura bilgileri</h2>
        {customer ? (
          <div className="mt-4">
            <p className="text-sm leading-6 font-medium wrap-anywhere">
              {customer.name ?? "Bireysel müşteri"}
            </p>
            <dl className="mt-4 space-y-4 text-xs">
              {customer.email ? (
                <div className="space-y-1">
                  <dt className="text-muted-foreground">E-posta</dt>
                  <dd className="leading-5 wrap-anywhere">{customer.email}</dd>
                </div>
              ) : null}
              {customer.address ? (
                <div className="space-y-1">
                  <dt className="text-muted-foreground">Fatura adresi</dt>
                  <dd className="leading-5 wrap-anywhere">
                    {customer.address}
                  </dd>
                </div>
              ) : null}
              {customer.taxIdentifier ? (
                <div className="space-y-1">
                  <dt className="text-muted-foreground">Vergi numarası</dt>
                  <dd className="leading-5 wrap-anywhere tabular-nums">
                    {customer.taxIdentifier}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {managedByPaddle && history === null
              ? "Fatura bilgileri şu anda alınamadı. Daha sonra yeniden deneyebilirsiniz."
              : "Fatura bilgileri başarılı ödemenizin ardından burada gösterilir."}
          </p>
        )}
      </section>
      <PaymentMethodDialog
        workspaceId={workspaceId}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onUpdated={handleUpdated}
      />
    </aside>
  )
}

function paymentMethodBrandLabel(method: BillingPaymentMethod) {
  if (!method.brand) return "Ödeme yöntemi"
  const brands: Record<string, string> = {
    visa: "VISA",
    mastercard: "Mastercard",
    master_card: "Mastercard",
    american_express: "American Express",
    amex: "American Express",
    maestro: "Maestro",
    discover: "Discover",
    diners_club: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
    union_pay: "UnionPay",
  }
  return brands[method.brand.toLowerCase()] ?? method.brand
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
