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
import { SUBSCRIPTION_PLANS } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import {
  formatBillingDate,
  formatBillingPeriod,
  getPlanPrice,
} from "@/lib/billing"
import type {
  BillingCycle,
  BillingHistory,
  BillingSubscriptionStatus,
  BillingSummary,
} from "@/types/billing"

const statusDetails: Record<
  BillingSubscriptionStatus,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  TRIALING: { label: "Ücretsiz deneme", variant: "success" },
  ACTIVE: { label: "Aktif", variant: "success" },
  PAST_DUE: { label: "Ödeme bekliyor", variant: "warning" },
  PAUSED: { label: "Duraklatıldı", variant: "warning" },
  CANCELED: { label: "İptal edildi", variant: "secondary" },
  EXPIRED: { label: "Süresi doldu", variant: "secondary" },
}

export function BillingOverview({
  storeId,
  summary,
  history,
}: {
  storeId: string
  summary: BillingSummary
  history: BillingHistory | null
}) {
  const plan =
    SUBSCRIPTION_PLANS.find(
      (candidate) => candidate.id === summary.subscription.plan.toLowerCase()
    ) ?? SUBSCRIPTION_PLANS[0]
  const cycle = summary.subscription.cycle.toLowerCase() as BillingCycle
  const price = getPlanPrice(plan, cycle)
  const status = statusDetails[summary.subscription.status]
  const isTrial = summary.subscription.status === "TRIALING"
  const isManaged = summary.subscription.managedByPaddle
  const renewalLabel = summary.subscription.cancelAtPeriodEnd
    ? "Erişim bitişi"
    : isTrial
      ? "Deneme bitişi"
      : "Bir sonraki yenileme"

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
              <Badge variant={status.variant} className="gap-1.5 text-[10px]">
                <span className="size-1 rounded-full bg-current" />
                {status.label}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-3">
              <h2
                id="current-plan-title"
                className="text-3xl font-semibold tracking-tight"
              >
                {isTrial ? "CoreAssist Deneme" : plan.name}
              </h2>
              <p className="text-2xl font-medium tracking-tight tabular-nums">
                {isTrial ? "Ücretsiz" : price.monthly}{" "}
                {!isTrial ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    / ay
                  </span>
                ) : null}
              </p>
            </div>

            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {isTrial
                ? "Deneme süreniz boyunca CoreAssist'in temel ürün soru operasyonunu gerçek verilerinizle deneyebilirsiniz."
                : plan.description}
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
              {[
                `Ayda ${summary.entitlements.monthlyAiQuestions.toLocaleString("tr-TR")} soru`,
                `${summary.entitlements.stores} mağaza`,
                `${summary.entitlements.members} kullanıcı`,
                "Tüm desteklenen pazaryerleri",
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
              {renewalLabel}
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              {formatBillingDate(summary.subscription.currentPeriodEnd)}
            </p>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Faturalama dönemi</dt>
                <dd>{cycle === "annual" ? "Yıllık" : "Aylık"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Dönem aralığı</dt>
                <dd className="text-right">
                  {formatBillingPeriod(
                    summary.subscription.currentPeriodStart,
                    summary.subscription.currentPeriodEnd
                  )}
                </dd>
              </div>
              {!isTrial ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Dönem ücreti</dt>
                  <dd className="font-medium tabular-nums">
                    {cycle === "annual" ? price.total : price.monthly}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="shadow-none">
              <Link href={APP_ROUTES.dashboard.settings.plans}>
                {isManaged ? "Planları görüntüle" : "Plan seç"}{" "}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={APP_ROUTES.dashboard.settings.invoices}>
                Faturaları görüntüle
              </Link>
            </Button>
          </div>
          {isManaged ? (
            <CancelSubscriptionDialog
              storeId={storeId}
              accessEndsAt={summary.subscription.currentPeriodEnd}
            />
          ) : null}
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,1fr)]">
        <SubscriptionUsage summary={summary} />
        <BillingPaymentDetails
          storeId={storeId}
          managedByPaddle={isManaged}
          history={history}
        />
      </div>

      {isManaged && !history ? (
        <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
          {"Ödeme ve fatura bilgileri şu anda Paddle'dan alınamadı. Daha sonra yeniden deneyebilirsiniz."}
        </p>
      ) : null}
    </main>
  )
}
