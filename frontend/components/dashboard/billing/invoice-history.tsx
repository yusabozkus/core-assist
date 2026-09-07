import { ArrowRight01Icon, Invoice03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { formatInvoiceAmount } from "@/lib/billing"
import type { InvoiceRecord } from "@/types/billing"
import { InvoiceStatusBadge } from "./invoice-status-badge"

export function InvoiceHistory({
  invoices,
  onSelect,
  onReset,
}: {
  invoices: readonly InvoiceRecord[]
  onSelect: (invoice: InvoiceRecord) => void
  onReset: () => void
}) {
  if (!invoices.length)
    return (
      <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
        <HugeiconsIcon
          icon={Invoice03Icon}
          className="size-8 text-muted-foreground/60"
        />
        <h3 className="mt-5 text-sm font-semibold">
          Eşleşen fatura bulunamadı
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Başka bir arama veya farklı bir dönem deneyin.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={onReset}
        >
          Filtreleri temizle
        </Button>
      </div>
    )
  return (
    <>
      <div className="themed-scrollbar hidden overflow-x-auto md:block">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            Abonelik faturaları, ödeme durumları ve tutarları
          </caption>
          <thead className="border-y border-border bg-muted/25 text-muted-foreground">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">
                Fatura
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Fatura dönemi
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Durum
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Tutar <span className="font-normal">(KDV dahil)</span>
              </th>
              <th scope="col" className="w-12 px-5 py-3">
                <span className="sr-only">Detay</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="group transition-colors hover:bg-muted/25"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                      <HugeiconsIcon
                        icon={Invoice03Icon}
                        className="size-4 text-muted-foreground"
                      />
                    </span>
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelect(invoice)}
                        className="rounded-sm text-left text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {invoice.number}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invoice.issuedAt}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="whitespace-nowrap">{invoice.period}</p>
                  <p className="mt-1 text-muted-foreground">{invoice.plan}</p>
                </td>
                <td className="px-4 py-4">
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium whitespace-nowrap tabular-nums">
                  {formatInvoiceAmount(invoice.total)}
                </td>
                <td className="px-5 py-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${invoice.number} faturasının detayını aç`}
                    onClick={() => onSelect(invoice)}
                  >
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 text-muted-foreground group-hover:text-foreground"
                    />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-border border-t border-border md:hidden">
        {invoices.map((invoice) => (
          <button
            key={invoice.id}
            type="button"
            onClick={() => onSelect(invoice)}
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left outline-none hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {invoice.number}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {invoice.issuedAt}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {invoice.plan}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-medium tabular-nums">
                {formatInvoiceAmount(invoice.total)}
              </span>
              <span className="mt-2 flex justify-end">
                <InvoiceStatusBadge status={invoice.status} />
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
