"use client"

import Link from "next/link"
import { AiSparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import {
  getUsageBarClass,
  getUsageLevel,
  getUsageTextClass,
} from "@/components/dashboard/billing/billing-usage-utils"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

const numberFormatter = new Intl.NumberFormat("tr-TR")

export function SidebarUsageAlert() {
  const { usage } = useBillingUsage()
  if (!usage || usage.questions.percentage < 80) return null

  const questions = usage.questions
  const percentage = Math.min(100, Math.floor(questions.percentage))
  const exhausted = getUsageLevel(percentage) === "exhausted"
  const label = exhausted
    ? "AI soru kotanız doldu"
    : `AI kotanızın %${percentage}'i kullanıldı`
  const child = usage.canManageBilling ? (
    <Link href={APP_ROUTES.dashboard.settings.billing}>
      <UsageAlertContent
        percentage={percentage}
        remaining={questions.remaining}
      />
    </Link>
  ) : (
    <div>
      <UsageAlertContent
        percentage={percentage}
        remaining={questions.remaining}
      />
    </div>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={label}
          className={cn(
            "h-auto min-h-11 border px-2.5 py-2",
            exhausted
              ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
              : "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
          )}
        >
          {child}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UsageAlertContent({
  percentage,
  remaining,
}: {
  percentage: number
  remaining: number
}) {
  return (
    <>
      <HugeiconsIcon
        icon={AiSparklesIcon}
        className={cn("size-4 shrink-0", getUsageTextClass(percentage))}
      />
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-medium">AI kotası</span>
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              getUsageTextClass(percentage)
            )}
          >
            %{percentage}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", getUsageBarClass(percentage))}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
        <p className="mt-1 truncate text-[9px] text-muted-foreground">
          {remaining === 0
            ? "Yeni AI yanıtı üretilemez"
            : `${numberFormatter.format(remaining)} soru kaldı`}
        </p>
      </div>
    </>
  )
}
