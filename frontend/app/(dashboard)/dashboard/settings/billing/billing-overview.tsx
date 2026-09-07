"use client"

import Link from "next/link"
import {
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BillingPageHeader } from "@/components/dashboard/billing/billing-page-header"
import { BillingPaymentDetails } from "@/components/dashboard/billing/billing-payment-details"
import { CancelSubscriptionDialog } from "@/components/dashboard/billing/cancel-subscription-dialog"
import { SubscriptionUsage } from "@/components/dashboard/billing/subscription-usage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BILLING_PREVIEW } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import { formatPlanPrice } from "@/lib/billing"

export function BillingOverview() {
  const { plan } = BILLING_PREVIEW
  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-6 px-5 py-8 sm:px-8 lg:px-10">
      <BillingPageHeader active="overview" />
      <section
        aria-labelledby="current-plan-title"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Mevcut planınız
              </p>
              <Badge variant="success" className="gap-1.5 text-[10px]">
                <span className="size-1 rounded-full bg-current" />
                Aktif
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3">
              <h2
                id="current-plan-title"
                className="text-3xl font-semibold tracking-tight"
              >
                {plan.name}
              </h2>
              <p className="text-2xl font-medium tracking-tight tabular-nums">
                {formatPlanPrice(plan.monthlyPrice)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / ay
                </span>
              </p>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {plan.description}
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
              {[
                `Ayda ${plan.questions.toLocaleString("tr-TR")} soru`,
                `${plan.stores} mağaza`,
                `${plan.connections} bağlantı`,
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-3.5 text-primary"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center border-t border-border bg-muted/20 p-5 sm:p-7 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
              Bir sonraki yenileme
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              {BILLING_PREVIEW.renewsAt}
            </p>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Faturalama dönemi</dt>
                <dd>Aylık</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Plan ücreti</dt>
                <dd className="font-medium tabular-nums">
                  {formatPlanPrice(plan.monthlyPrice)}{" "}
                  <span className="font-normal text-muted-foreground">
                    + KDV
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="shadow-none">
              <Link href={APP_ROUTES.dashboard.settings.plans}>
                Planı değiştir{" "}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={APP_ROUTES.dashboard.settings.invoices}>
                Faturaları görüntüle
              </Link>
            </Button>
          </div>
          <CancelSubscriptionDialog />
        </div>
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,1fr)]">
        <SubscriptionUsage />
        <BillingPaymentDetails />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Abonelik ve ödeme bilgileri örnek olarak gösterilmektedir.
      </p>
    </main>
  )
}
