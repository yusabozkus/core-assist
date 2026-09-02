import { ArrowRight01Icon, Invoice03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type InvoiceStatus = "paid" | "refunded"

export type InvoiceRecord = {
  id: string
  number: string
  plan: string
  period: string
  issuedAt: string
  year: string
  subtotal: number
  tax: number
  total: number
  status: InvoiceStatus
  paymentMethod: string
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})

export function InvoiceHistory({
  invoices,
  onSelect,
}: {
  invoices: readonly InvoiceRecord[]
  onSelect: (invoice: InvoiceRecord) => void
}) {
  if (invoices.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <HugeiconsIcon icon={Invoice03Icon} className="size-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold">Fatura bulunamadı</h3>
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
          Seçtiğiniz yıl ve durumla eşleşen bir fatura kaydı bulunmuyor.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/25 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-6 py-3.5">Fatura</th>
              <th className="px-4 py-3.5">Dönem</th>
              <th className="px-4 py-3.5">Tarih</th>
              <th className="px-4 py-3.5 text-right">Tutar</th>
              <th className="px-4 py-3.5">Durum</th>
              <th className="w-12 px-5 py-3.5">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="transition-colors hover:bg-muted/25"
              >
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-foreground">
                    {invoice.number}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {invoice.plan}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {invoice.period}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {invoice.issuedAt}
                </td>
                <td className="px-4 py-4 text-right text-sm font-semibold text-foreground tabular-nums">
                  {currencyFormatter.format(invoice.total)}
                </td>
                <td className="px-4 py-4">
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${invoice.number} faturasını görüntüle`}
                    onClick={() => onSelect(invoice)}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border md:hidden">
        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            type="button"
            onClick={() => onSelect(invoice)}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/25"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <HugeiconsIcon icon={Invoice03Icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {invoice.number}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {invoice.issuedAt} · {invoice.period}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold text-foreground tabular-nums">
                {currencyFormatter.format(invoice.total)}
              </span>
              <span className="mt-1 flex justify-end">
                <InvoiceStatusBadge status={invoice.status} />
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return status === "paid" ? (
    <Badge variant="success">
      <span className="size-1.5 rounded-full bg-current" />
      Ödendi
    </Badge>
  ) : (
    <Badge variant="warning">
      <span className="size-1.5 rounded-full bg-current" />
      İade edildi
    </Badge>
  )
}

export function formatInvoiceAmount(amount: number) {
  return currencyFormatter.format(amount)
}
