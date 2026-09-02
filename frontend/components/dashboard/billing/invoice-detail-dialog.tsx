"use client"

import { Download02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  formatInvoiceAmount,
  InvoiceStatusBadge,
  type InvoiceRecord,
} from "@/components/dashboard/billing/invoice-history"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"

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
      title={invoice?.number ?? "Fatura detayı"}
      description={
        invoice
          ? `${invoice.issuedAt} tarihinde oluşturulan abonelik faturası.`
          : undefined
      }
      contentClassName="sm:max-w-xl"
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" onClick={close}>
            Kapat
          </Button>
          <Button type="button">
            <HugeiconsIcon icon={Download02Icon} className="size-4" />
            PDF indir
          </Button>
        </>
      )}
    >
      {invoice ? (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Fatura durumu
              </p>
              <div className="mt-2">
                <InvoiceStatusBadge status={invoice.status} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">
                Toplam tutar
              </p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.025em]">
                {formatInvoiceAmount(invoice.total)}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-border rounded-xl border border-border bg-secondary/25 px-4">
            <InvoiceDetailRow label="Plan" value={invoice.plan} />
            <InvoiceDetailRow label="Fatura dönemi" value={invoice.period} />
            <InvoiceDetailRow
              label="Ara toplam"
              value={formatInvoiceAmount(invoice.subtotal)}
            />
            <InvoiceDetailRow
              label="KDV (%20)"
              value={formatInvoiceAmount(invoice.tax)}
            />
            <InvoiceDetailRow
              label="Ödeme yöntemi"
              value={invoice.paymentMethod}
            />
          </dl>

          <div className="border-t border-border pt-5">
            <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
              Fatura adresi
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              North Clothing Teknoloji ve Ticaret Ltd. Şti.
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Maslak Mah. Büyükdere Cad. No: 123 Sarıyer / İstanbul
              <br />
              Vergi No: 123 456 7890
            </p>
          </div>
        </div>
      ) : null}
    </ResponsiveDialog>
  )
}

function InvoiceDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium text-foreground">
        {value}
      </dd>
    </div>
  )
}
