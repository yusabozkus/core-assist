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
  getUsageBarClass,
  getUsageTextClass,
} from "@/components/dashboard/billing/billing-usage-utils"
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
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,1fr)] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="dashboard-plan-usage-title"
              className="text-sm font-semibold tracking-tight"
            >
              Plan kullanımı
            </h2>
            <Badge variant="outline" className="px-2 py-0 text-[10px]">
              {billingPlanLabels[usage.plan]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Hesap geneli
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
                <span className="text-xs font-medium">AI soru kotası</span>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                {numberFormatter.format(questions.used)}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  / {numberFormatter.format(questions.limit)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  getUsageTextClass(percentage)
                )}
              >
                {isExhausted
                  ? "Kota doldu"
                  : `${numberFormatter.format(questions.remaining)} soru kaldı`}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatUsagePeriod(usage)}
              </p>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="AI soru kotası"
            aria-valuemin={0}
            aria-valuemax={questions.limit}
            aria-valuenow={Math.min(questions.used, questions.limit)}
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                getUsageBarClass(percentage)
              )}
              style={{ width: `${Math.min(100, questions.percentage)}%` }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          {usage.capacity ? (
            <div className="grid grid-cols-3 gap-3">
              <CapacityItem
                label="Mağaza"
                icon={Store01Icon}
                usage={usage.capacity.stores}
              />
              <CapacityItem
                label="Kullanıcı"
                icon={UserCircleIcon}
                usage={usage.capacity.members}
              />
              <CapacityItem
                label="Ürün"
                icon={Package01Icon}
                usage={usage.capacity.activeProducts}
              />
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium">Kullanım sınırı</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                AI yanıt hakkı bu çalışma alanındaki tüm mağazalarla ortak
                kullanılır.
              </p>
            </div>
          )}

          {usage.canManageBilling ? (
            <Button
              asChild
              size="sm"
              variant={percentage >= 80 ? "default" : "outline"}
              className="self-start lg:self-end"
            >
              <Link href={APP_ROUTES.dashboard.settings.billing}>
                {percentage >= 80 ? "Planı incele" : "Kullanımı yönet"}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Link>
            </Button>
          ) : null}
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
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-3.5 shrink-0" />
        <span className="truncate text-[10px]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums">
        {numberFormatter.format(usage.used)}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          / {numberFormatter.format(usage.limit)}
        </span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            getUsageBarClass(usage.percentage)
          )}
          style={{ width: `${Math.min(100, usage.percentage)}%` }}
        />
      </div>
    </div>
  )
}
