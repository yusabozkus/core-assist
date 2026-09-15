"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import { Button } from "@/components/ui/button"
import { createBillingPortalSession } from "@/lib/api/billing"
import { markBillingPortalVisit } from "@/lib/billing-portal-return"
import { billingRoutes } from "@/lib/billing-routes"
import { cn } from "@/lib/utils"

export function BillingPaymentIssueShell({
  workspaceId,
  children,
}: {
  workspaceId?: string
  children: React.ReactNode
}) {
  const { usage } = useBillingUsage()
  const hasPaymentIssue = usage?.status === "PAST_DUE"
  const hasExpiredAccess = usage?.status === "EXPIRED"
  const hasBillingAlert = hasPaymentIssue || hasExpiredAccess

  return (
    <div
      className={cn(
        "flex h-svh flex-col overflow-hidden [--sidebar-top-offset:0px]",
        hasBillingAlert &&
          "[--sidebar-top-offset:3.5rem] sm:[--sidebar-top-offset:3rem]"
      )}
    >
      <BillingPaymentIssueBanner workspaceId={workspaceId} />
      <div className="relative flex min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function BillingPaymentIssueBanner({
  workspaceId,
}: {
  workspaceId?: string
}) {
  const { usage } = useBillingUsage()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPaymentIssue = usage?.status === "PAST_DUE"
  const hasExpiredAccess = usage?.status === "EXPIRED"

  if (!hasPaymentIssue && !hasExpiredAccess) return null

  const canManageBilling = usage.canManageBilling && Boolean(workspaceId)

  async function openPaymentSettings() {
    if (!workspaceId || isOpening) return

    setIsOpening(true)
    setError(null)
    try {
      const session = await createBillingPortalSession(workspaceId)
      markBillingPortalVisit(workspaceId)
      window.location.assign(
        session.updatePaymentMethodUrl ?? session.overviewUrl
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ödeme yönetimi şu anda açılamıyor."
      )
      setIsOpening(false)
    }
  }

  return (
    <section
      role="alert"
      aria-labelledby="billing-payment-issue-title"
      className={cn(
        "relative z-50 h-14 shrink-0 border-b px-3 sm:h-12 sm:px-4",
        hasPaymentIssue
          ? "border-destructive/20 bg-destructive/[0.055]"
          : "border-amber-500/25 bg-amber-500/[0.07]"
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              hasPaymentIssue
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/12 text-amber-700 dark:text-amber-400"
            )}
          >
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
          </span>
          <div className="min-w-0 md:flex md:items-baseline md:gap-2">
            <p
              id="billing-payment-issue-title"
              className="truncate text-xs font-semibold text-foreground sm:text-sm"
            >
              {hasPaymentIssue
                ? "Ödemeniz alınamadı"
                : "Deneme süreniz sona erdi"}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {hasPaymentIssue
                ? "Hizmet kesintisini önlemek için ödeme yönteminizi kontrol edin."
                : "AI ve senkronizasyonları yeniden kullanmak için bir plan seçin."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {hasPaymentIssue && error ? (
            <p
              className="hidden max-w-72 truncate text-xs text-destructive lg:block"
              role="status"
            >
              {error}
            </p>
          ) : null}
          {canManageBilling && hasPaymentIssue ? (
            <Button
              type="button"
              size="sm"
              className="h-8 bg-destructive px-3 text-destructive-foreground shadow-none hover:bg-destructive/90"
              disabled={isOpening}
              onClick={openPaymentSettings}
            >
              <HugeiconsIcon
                icon={isOpening ? Loading03Icon : ArrowRight01Icon}
                className={isOpening ? "size-3.5 animate-spin" : "size-3.5"}
              />
              <span className="sm:hidden">
                {isOpening ? "Açılıyor" : "Düzelt"}
              </span>
              <span className="hidden sm:inline">
                {isOpening ? "Açılıyor" : "Ödemeyi düzelt"}
              </span>
            </Button>
          ) : canManageBilling && workspaceId ? (
            <Button asChild type="button" size="sm" className="h-8 px-3">
              <Link href={billingRoutes(workspaceId).plans}>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                <span className="sm:hidden">Plan seç</span>
                <span className="hidden sm:inline">Planları incele</span>
              </Link>
            </Button>
          ) : (
            <span
              className={cn(
                "hidden text-xs font-medium sm:inline",
                hasPaymentIssue
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-400"
              )}
            >
              Çalışma alanı yöneticinizin işlem yapması gerekiyor.
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
