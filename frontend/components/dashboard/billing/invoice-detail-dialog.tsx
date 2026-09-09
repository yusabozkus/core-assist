"use client"

import { useState } from "react"
import { Download04Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { getBillingInvoicePdf } from "@/lib/api/billing"
import {
  formatBillingAmount,
  formatBillingDate,
  formatBillingPeriod,
  getInvoiceDescription,
} from "@/lib/billing"
import type { BillingPaymentMethod, InvoiceRecord } from "@/types/billing"
import { InvoiceStatusBadge } from "./invoice-status-badge"

export function InvoiceDetailDialog({
  storeId,
  invoice,
  onOpenChange,
}: {
  storeId: string
  invoice: InvoiceRecord | null
  onOpenChange: (open: boolean) => void
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function downloadInvoice() {
    if (!invoice) return
    setIsDownloading(true)
    setError(null)
    try {
      const result = await getBillingInvoicePdf(
        storeId,
        invoice.transactionId
      )
      window.location.assign(result.url)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Fatura belgesi şu anda indirilemiyor."
      )
      setIsDownloading(false)
    }
  }

  return (
    <ResponsiveDialog
      open={invoice !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(null)
          setIsDownloading(false)
        }
        onOpenChange(open)
      }}
      title="Fatura detayı"
      description={invoice?.number}
      preventClose={isDownloading}
      contentClassName="sm:max-w-xl"
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDownloading}
            onClick={close}
          >
            Kapat
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isDownloading}
            onClick={downloadInvoice}
          >
            <HugeiconsIcon
              icon={isDownloading ? Loading03Icon : Download04Icon}
              className={isDownloading ? "size-3.5 animate-spin" : "size-3.5"}
            />
            {isDownloading ? "Hazırlanıyor" : "Faturayı indir"}
          </Button>
        </>
      )}
    >
      {invoice ? (
        <div className="space-y-6 py-3 sm:px-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">CoreAssist</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Paddle abonelik faturası
              </p>
            </div>
            <InvoiceStatusBadge status={invoice.status} />
          </div>

          <div className="grid grid-cols-2 gap-5 border-y border-border py-5 text-xs">
            <div>
              <p className="text-muted-foreground">Fatura numarası</p>
              <p className="mt-1.5 font-medium">{invoice.number}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Düzenleme tarihi</p>
              <p className="mt-1.5 font-medium">
                {formatBillingDate(invoice.issuedAt)}
              </p>
            </div>
            {invoice.billingCustomer ? (
              <div className="col-span-2">
                <p className="text-muted-foreground">Fatura alıcısı</p>
                <p className="mt-2 text-sm leading-6 font-medium">
                  {invoice.billingCustomer.name ?? "Bireysel müşteri"}
                </p>
                {invoice.billingCustomer.email ? (
                  <p className="mt-1 leading-5 text-muted-foreground">
                    {invoice.billingCustomer.email}
                  </p>
                ) : null}
                {invoice.billingCustomer.address ? (
                  <p className="mt-1 leading-5 text-muted-foreground">
                    {invoice.billingCustomer.address}
                  </p>
                ) : null}
                {invoice.billingCustomer.taxIdentifier ? (
                  <p className="mt-2 text-muted-foreground">
                    Vergi no:{" "}
                    <span className="text-foreground">
                      {invoice.billingCustomer.taxIdentifier}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-[11px] text-muted-foreground">
              <span>Açıklama</span>
              <span>Tutar</span>
            </div>
            <div className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">
                  {getInvoiceDescription(invoice)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatBillingPeriod(
                    invoice.periodStart,
                    invoice.periodEnd
                  )}
                </p>
              </div>
              <p className="text-sm font-medium whitespace-nowrap tabular-nums">
                {formatBillingAmount(invoice.subtotal, invoice.currency)}
              </p>
            </div>
            <dl className="ml-auto max-w-xs space-y-3 border-t border-border pt-4 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ara toplam</dt>
                <dd className="tabular-nums">
                  {formatBillingAmount(invoice.subtotal, invoice.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vergi</dt>
                <dd className="tabular-nums">
                  {formatBillingAmount(invoice.tax, invoice.currency)}
                </dd>
              </div>
              {invoice.refundedAmount > 0 ? (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <dt>İade</dt>
                  <dd className="tabular-nums">
                    −{formatBillingAmount(invoice.refundedAmount, invoice.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <dt className="font-medium">Toplam</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums">
                  {formatBillingAmount(invoice.total, invoice.currency)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs">
            <span className="text-muted-foreground">Ödeme yöntemi</span>
            <span>{paymentMethodLabel(invoice.paymentMethod)}</span>
          </div>

          {error ? (
            <p role="alert" className="text-xs leading-5 text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </ResponsiveDialog>
  )
}

function paymentMethodLabel(method: BillingPaymentMethod | null) {
  if (!method) return "Belirtilmedi"
  if (method.type === "card" && method.last4) {
    return `${method.brand?.toLocaleUpperCase("tr-TR") ?? "Kart"} •••• ${method.last4}`
  }
  const labels: Record<string, string> = {
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    paypal: "PayPal",
  }
  return labels[method.type] ?? method.type
}
