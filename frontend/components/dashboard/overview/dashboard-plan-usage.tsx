"use client"

import Link from "next/link"
import {
  AiSparklesIcon,
  ArrowRight01Icon,
  Package01Icon,
  Store01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import {
  billingPlanLabels,
  formatUsagePeriod,
  getUsageTextClass,
} from "@/components/dashboard/billing/billing-usage-utils"
import { UsageRadialChart } from "@/components/dashboard/billing/usage-radial-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type { StoreBillingUsageOverview } from "@/types/billing"

const numberFormatter = new Intl.NumberFormat("tr-TR")

export function DashboardPlanUsage() {
  const { usage } = useBillingUsage()
  if (!usage) return null

  const questions = usage.questions
  const percentage = Math.min(100, Math.floor(questions.percentage))
  const isExhausted = questions.remaining === 0

  return (
    <section
      aria-labelledby="dashboard-plan-usage-title"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="grid xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,1fr)]">
        <div className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={AiSparklesIcon} className="size-4.5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="dashboard-plan-usage-title"
                    className="text-sm font-semibold tracking-tight"
                  >
                    AI soru kotası
                  </h2>
                  <Badge variant="outline" className="px-2 py-0 text-[10px]">
                    {billingPlanLabels[usage.plan]}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Tüm mağazaların ortak dönem kullanımı
                </p>
              </div>
            </div>

            {usage.canManageBilling ? (
              <Button
                asChild
                size="sm"
                variant={percentage >= 80 ? "default" : "outline"}
                className={percentage < 80 ? "bg-card" : undefined}
              >
                <Link href={APP_ROUTES.dashboard.settings.billing}>
                  {percentage >= 80 ? "Planı incele" : "Kullanımı yönet"}
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="mt-5 flex items-center gap-3 sm:mt-6 sm:gap-5">
            <UsageRadialChart
              value={percentage}
              label="AI soru kotası"
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Bu dönem kullanılan
              </p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:gap-x-2 sm:text-3xl">
                <span>{numberFormatter.format(questions.used)}</span>
                <span className="text-xs font-normal text-muted-foreground sm:text-sm">
                  / {numberFormatter.format(questions.limit)} soru
                </span>
              </p>
              <div className="mt-2 flex flex-col gap-0.5 text-[11px] sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:text-xs">
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    getUsageTextClass(percentage)
                  )}
                >
                  {isExhausted
                    ? "Kota doldu"
                    : `${numberFormatter.format(questions.remaining)} soru kaldı`}
                </span>
                <span className="hidden text-muted-foreground sm:inline">
                  •
                </span>
                <span className="text-muted-foreground">
                  {formatUsagePeriod(usage)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-muted/[0.16] p-5 sm:p-6 xl:border-t-0 xl:border-l">
          <div>
            <h3 className="text-sm font-semibold">Plan kapasitesi</h3>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Çalışma alanındaki mevcut kullanım
            </p>
          </div>

          {usage.capacity ? (
            <dl className="mt-4 divide-y divide-border/70">
              <CapacityItem
                label="Mağazalar"
                icon={Store01Icon}
                usage={usage.capacity.stores}
              />
              <CapacityItem
                label="Ekip üyeleri"
                icon={UserCircleIcon}
                usage={usage.capacity.members}
              />
              <CapacityItem
                label="Aktif ürünler"
                icon={Package01Icon}
                usage={usage.capacity.activeProducts}
              />
            </dl>
          ) : (
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Kapasite bilgileri şu anda görüntülenemiyor.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function CapacityItem({
  label,
  icon,
  usage,
}: {
  label: string
  icon: typeof Store01Icon
  usage: NonNullable<StoreBillingUsageOverview["capacity"]>["stores"]
}) {
  const percentage = Math.min(100, Math.floor(usage.percentage))

  return (
    <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium">{label}</dt>
        <dd className="mt-1 text-[10px] text-muted-foreground">
          {usage.remaining > 0
            ? `${numberFormatter.format(usage.remaining)} kapasite kullanılabilir`
            : "Plan sınırına ulaşıldı"}
        </dd>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {numberFormatter.format(usage.used)}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          / {numberFormatter.format(usage.limit)}
        </span>
        <span className="sr-only"> (%{percentage})</span>
      </p>
    </div>
  )
}
