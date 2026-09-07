import { formatInvoiceAmount } from "@/lib/billing"
import type { InvoiceRecord } from "@/types/billing"

export function InvoiceSummary({
  invoices,
  year,
}: {
  invoices: readonly InvoiceRecord[]
  year: string
}) {
  const paid = invoices.filter((invoice) => invoice.status === "paid")
  const refunded = invoices.filter((invoice) => invoice.status === "refunded")
  const lastPaid = paid[0]
  const items = [
    {
      label: `${year === "all" ? "Tüm dönemler" : year} · toplam ödeme`,
      value: formatInvoiceAmount(
        paid.reduce((total, invoice) => total + invoice.total, 0)
      ),
      detail: `${paid.length} başarılı ödeme · KDV dahil`,
    },
    {
      label: "Son başarılı ödeme",
      value: lastPaid ? formatInvoiceAmount(lastPaid.total) : "—",
      detail: lastPaid?.issuedAt ?? "Bu dönemde ödeme yok",
    },
    {
      label: "İade edilen",
      value: formatInvoiceAmount(
        refunded.reduce((total, invoice) => total + invoice.total, 0)
      ),
      detail: refunded.length
        ? `${refunded.length} fatura iade edildi`
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
