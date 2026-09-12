"use client"

import Link from "next/link"
import { AiSparklesIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import {
  formatUsagePeriod,
  getUsageBarClass,
  getUsageTextClass,
} from "@/components/dashboard/billing/billing-usage-utils"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

const numberFormatter = new Intl.NumberFormat("tr-TR")

export function AiQuotaIndicator({ className }: { className?: string }) {
  const { usage } = useBillingUsage()
  if (!usage) return null

  const questions = usage.questions
  const percentage = Math.min(100, Math.floor(questions.percentage))
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">AI soru kotası</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Mevcut faturalama dönemi
            </p>
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            getUsageTextClass(percentage)
          )}
        >
          %{percentage}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-xl font-semibold tracking-tight tabular-nums">
          {numberFormatter.format(questions.used)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            / {numberFormatter.format(questions.limit)}
          </span>
        </p>
        <p
          className={cn(
            "text-[10px] font-semibold",
            getUsageTextClass(percentage)
          )}
        >
          {questions.remaining === 0
            ? "Kota doldu"
            : `${numberFormatter.format(questions.remaining)} kaldı`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="AI soru kotası"
        aria-valuemin={0}
        aria-valuemax={questions.limit}
        aria-valuenow={Math.min(questions.used, questions.limit)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            getUsageBarClass(percentage)
          )}
          style={{ width: `${Math.min(100, questions.percentage)}%` }}
        />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[10px] text-muted-foreground">
        <span>{formatUsagePeriod(usage)}</span>
        {usage.canManageBilling ? (
          <span className="flex items-center gap-1 font-medium text-foreground">
            Kullanımı yönet
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </span>
        ) : null}
      </div>
    </>
  )

  const rootClassName = cn(
    "flex min-h-48 w-full flex-col rounded-xl border border-border bg-card p-5 transition-colors sm:p-6",
    className
  )

  return usage.canManageBilling ? (
    <Link
      href={APP_ROUTES.dashboard.settings.billing}
      className={cn(rootClassName, "hover:border-primary/20 hover:bg-muted/40")}
    >
      {content}
    </Link>
  ) : (
    <div className={rootClassName}>{content}</div>
  )
}
