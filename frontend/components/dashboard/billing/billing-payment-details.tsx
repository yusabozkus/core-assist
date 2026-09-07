import { CreditCardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BILLING_PREVIEW } from "@/constants/billing"

export function BillingPaymentDetails() {
  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card">
      <section className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Ödeme yöntemi</h2>
        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-bold tracking-tight italic">
            VISA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">•••• 4242</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Son kullanma {BILLING_PREVIEW.cardExpiry}
            </p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Varsayılan
          </span>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <HugeiconsIcon
            icon={CreditCardIcon}
            className="mt-0.5 size-3.5 shrink-0"
          />
          Yenileme ödemeleri bu kart üzerinden alınır.
        </p>
      </section>
      <section className="border-t border-border p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Fatura bilgileri</h2>
        <p className="mt-4 text-sm leading-6 font-medium">
          {BILLING_PREVIEW.company}
        </p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {BILLING_PREVIEW.address}
        </p>
        <dl className="mt-4 flex justify-between gap-3 text-xs">
          <dt className="text-muted-foreground">Vergi numarası</dt>
          <dd className="tabular-nums">{BILLING_PREVIEW.taxNumber}</dd>
        </dl>
      </section>
    </aside>
  )
}
