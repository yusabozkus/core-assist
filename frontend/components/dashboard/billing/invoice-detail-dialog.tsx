"use client"

import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { BILLING_PREVIEW } from "@/constants/billing"
import { formatInvoiceAmount } from "@/lib/billing"
import type { InvoiceRecord } from "@/types/billing"
import { InvoiceStatusBadge } from "./invoice-status-badge"

export function InvoiceDetailDialog({
  invoice,
  onOpenChange,
}: {
  invoice: InvoiceRecord | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog
      open={invoice !== null}
      onOpenChange={onOpenChange}
      title="Fatura detayı"
      description={invoice?.number}
      contentClassName="sm:max-w-xl"
      footer={({ close }) => (
        <>
          <span className="mr-auto self-center text-[11px] text-muted-foreground">
            Örnek fatura · Resmî belge değildir.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Kapat
          </Button>
        </>
      )}
    >
      {invoice && (
        <div className="space-y-6 py-3 sm:px-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">CoreAssist</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Abonelik faturası
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
              <p className="mt-1.5 font-medium">{invoice.issuedAt}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Fatura alıcısı</p>
              <p className="mt-2 text-sm leading-6 font-medium">
                {BILLING_PREVIEW.company}
              </p>
              <p className="mt-1 leading-5 text-muted-foreground">
                {BILLING_PREVIEW.address}
              </p>
              <p className="mt-2 text-muted-foreground">
                Vergi no:{" "}
                <span className="text-foreground">
                  {BILLING_PREVIEW.taxNumber}
                </span>
              </p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-[11px] text-muted-foreground">
              <span>Açıklama</span>
              <span>Tutar</span>
            </div>
            <div className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium">{invoice.plan}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {invoice.period}
                </p>
              </div>
              <p className="text-sm font-medium whitespace-nowrap tabular-nums">
                {formatInvoiceAmount(invoice.subtotal)}
              </p>
            </div>
            <dl className="ml-auto max-w-xs space-y-3 border-t border-border pt-4 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ara toplam</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(invoice.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">KDV (%20)</dt>
                <dd className="tabular-nums">
                  {formatInvoiceAmount(invoice.tax)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <dt className="font-medium">Toplam</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums">
                  {formatInvoiceAmount(invoice.total)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs">
            <span className="text-muted-foreground">Ödeme yöntemi</span>
            <span>{invoice.paymentMethod}</span>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  )
}
