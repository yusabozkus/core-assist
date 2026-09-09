import { formatBillingAmount, formatBillingDate } from "@/lib/billing"
import type { InvoiceRecord } from "@/types/billing"

export function InvoiceSummary({
  invoices,
  year,
}: {
  invoices: readonly InvoiceRecord[]
  year: string
}) {
  const currency = invoices[0]?.currency ?? "TRY"
  const totalPaid = invoices.reduce(
    (total, invoice) => total + invoice.total - invoice.refundedAmount,
    0
  )
  const totalRefunded = invoices.reduce(
    (total, invoice) => total + invoice.refundedAmount,
    0
  )
  const lastPaid = invoices[0]
  const refundedCount = invoices.filter(
    (invoice) => invoice.refundedAmount > 0
  ).length
  const items = [
    {
      label: `${year === "all" ? "Tüm dönemler" : year} · net ödeme`,
      value: formatBillingAmount(totalPaid, currency),
      detail: `${invoices.length} tamamlanan işlem · vergiler dahil`,
    },
    {
      label: "Son başarılı ödeme",
      value: lastPaid
        ? formatBillingAmount(lastPaid.total, lastPaid.currency)
        : "—",
      detail: lastPaid
        ? formatBillingDate(lastPaid.issuedAt)
        : "Henüz ödeme bulunmuyor",
    },
    {
      label: "İade edilen",
      value: formatBillingAmount(totalRefunded, currency),
      detail: refundedCount
        ? `${refundedCount} işlemde iade bulunuyor`
        : "Bu dönemde iade bulunmuyor",
    },
  ]

  return (
    <section
      aria-label="Dönemin ödeme özeti"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <dl className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="px-5 py-5 sm:px-6">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
              {item.value}
            </dd>
            <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </dl>
    </section>
  )
}
