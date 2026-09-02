import {
  Calendar03Icon,
  CreditCardIcon,
  Invoice03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { formatInvoiceAmount } from "@/components/dashboard/billing/invoice-history"

export function InvoiceSummary({ paidTotal }: { paidTotal: number }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <dl className="grid sm:grid-cols-3">
        <BillingSummaryItem
          icon={Invoice03Icon}
          label="2026 toplam ödeme"
          value={formatInvoiceAmount(paidTotal)}
          detail="8 başarılı ödeme"
        />
        <BillingSummaryItem
          icon={Calendar03Icon}
          label="Son ödeme"
          value="15 Ağustos 2026"
          detail={formatInvoiceAmount(7200)}
        />
        <BillingSummaryItem
          icon={CreditCardIcon}
          label="Ödeme yöntemi"
          value="Visa •••• 4242"
          detail="Son kullanma 08/29"
        />
      </dl>
    </section>
  )
}

function BillingSummaryItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-5 not-last:border-b not-last:border-border sm:px-6 sm:not-last:border-r sm:not-last:border-b-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} className="size-4.5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-1 truncate text-sm font-semibold text-foreground">
          {value}
        </dd>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
