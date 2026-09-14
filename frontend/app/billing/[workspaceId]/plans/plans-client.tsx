"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarCheck01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BillingCycleToggle } from "@/components/dashboard/billing/billing-cycle-toggle"
import { PlanCard } from "@/components/dashboard/billing/plan-card"
import { PlanChangeDialog } from "@/components/dashboard/billing/plan-change-dialog"
import { PendingPlanChange } from "@/components/dashboard/billing/pending-plan-change"
import { PlanQuestions } from "@/components/dashboard/billing/plan-questions"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Button } from "@/components/ui/button"
import { SUBSCRIPTION_PLANS } from "@/constants/billing"
import { formatBillingDate } from "@/lib/billing"
import { billingRoutes } from "@/lib/billing-routes"
import { APP_ROUTES } from "@/constants/site"
import { commonAnnualDiscount, usePaddlePricing } from "@/lib/paddle-pricing"
import type {
  BillingCycle,
  BillingPlanId,
  BillingSummary,
} from "@/types/billing"

export function PlansClient({
  initialBillingSummary,
  workspaceId,
}: {
  initialBillingSummary: BillingSummary | null
  workspaceId: string
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialBillingSummary?.subscription.cycle === "ANNUAL"
      ? "annual"
      : "monthly"
  )
  const [selection, setSelection] = useState<{
    plan: BillingPlanId
    cycle: BillingCycle
    key: number
  } | null>(null)
  const [changeOpen, setChangeOpen] = useState(false)
  const pricing = usePaddlePricing()
  const annualDiscount = commonAnnualDiscount(pricing.prices)
  const managed = Boolean(
    initialBillingSummary?.subscription.managedByPaddle &&
    !["CANCELED", "EXPIRED"].includes(initialBillingSummary.subscription.status)
  )
  const canChange =
    initialBillingSummary?.subscription.status === "ACTIVE" &&
    !initialBillingSummary.subscription.cancelAtPeriodEnd
  const pendingChange = initialBillingSummary?.pendingPlanChange
  const currentPlan = managed
    ? SUBSCRIPTION_PLANS.find(
        (plan) =>
          plan.id === initialBillingSummary?.subscription.plan.toLowerCase()
      )
    : null
  const currentPlanLabel =
    currentPlan?.name ??
    (initialBillingSummary?.subscription.status === "TRIALING"
      ? "Ücretsiz deneme"
      : "Aktif plan yok")
  const trialActive = Boolean(
    initialBillingSummary?.subscription.status === "TRIALING" &&
    initialBillingSummary.subscription.active
  )
  const trialEndsAt = trialActive
    ? initialBillingSummary?.subscription.trialEndsAt
    : null
  return (
    <main className="themed-scrollbar fixed inset-0 z-40 overflow-y-auto overscroll-y-contain bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95">
        <div className="mx-auto flex h-18 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AppLogo href={billingRoutes(workspaceId).overview} />
          <div className="flex items-center gap-5">
            <span className="hidden text-xs text-muted-foreground sm:block">
              Mevcut planınız{" "}
              <span className="ml-1 font-medium text-foreground">
                {currentPlanLabel}
              </span>
            </span>
            <Button
              asChild
              variant="outline"
              size="icon-sm"
              className="bg-card"
            >
              <Link
                href={billingRoutes(workspaceId).overview}
                aria-label="Planları kapat ve aboneliğe dön"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1440px] space-y-9 px-5 py-9 sm:px-8 sm:py-12 lg:px-10">
        <section className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-primary">
              <HugeiconsIcon icon={CalendarCheck01Icon} className="size-4" />
              {managed
                ? "Mevcut aboneliğinizi yönetin"
                : trialActive
                  ? trialEndsAt
                    ? `Ücretsiz denemeniz ${formatBillingDate(trialEndsAt)} tarihine kadar aktif`
                    : "Ücretsiz denemeniz aktif"
                  : "Ücretli aboneliğinizi başlatın"}
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              İşinize uygun kapasiteyi seçin.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Tüm AI, otomasyon ve performans özellikleri her planda açık.
              Yalnızca operasyonunuza uygun kapasiteyi seçin.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2.5 lg:items-end">
            <BillingCycleToggle
              value={billingCycle}
              onChange={setBillingCycle}
              annualDiscount={annualDiscount}
            />
            <p className="text-xs text-muted-foreground">
              {pricing.loading
                ? "Paddle üzerinden güncel fiyatlar hesaplanıyor."
                : annualDiscount
                  ? `Yıllık ödemede %${annualDiscount.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} tasarruf edin.`
                  : "Yıllık plan avantajını güncel fiyatlarda inceleyin."}
            </p>
          </div>
        </section>
        {pendingChange && (
          <PendingPlanChange workspaceId={workspaceId} change={pendingChange} />
        )}
        {!initialBillingSummary && (
          <p role="alert" className="text-sm text-destructive">
            Abonelik bilgisi alınamadı. İşlem başlatmadan önce sayfayı
            yenileyin.
          </p>
        )}
        {managed && !canChange && (
          <p className="text-sm leading-6 text-muted-foreground">
            Plan değişikliği için aboneliğiniz aktif olmalı ve bekleyen iptal
            bulunmamalı.{" "}
            <Link
              href={billingRoutes(workspaceId).overview}
              className="font-medium text-primary underline underline-offset-4"
            >
              Abonelik durumunu kontrol edin.
            </Link>
          </p>
        )}
        {pricing.error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">
              Güncel Paddle fiyatları alınamadı. Plan seçmeden önce tekrar
              deneyin.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={pricing.retry}
            >
              Fiyatları yenile
            </Button>
          </div>
        ) : null}
        <section
          aria-label="Abonelik planları"
          className="grid items-stretch gap-4 lg:grid-cols-3"
        >
          {SUBSCRIPTION_PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              price={pricing.prices?.[plan.id][billingCycle] ?? null}
              priceLoading={pricing.loading}
              checkoutHref={`${APP_ROUTES.checkout}?workspaceId=${encodeURIComponent(workspaceId)}&plan=${plan.id}&cycle=${billingCycle}`}
              disabled={
                !initialBillingSummary ||
                !pricing.prices ||
                Boolean(pendingChange) ||
                (managed && !canChange)
              }
              onSelect={
                managed
                  ? () => {
                      setSelection({
                        plan: plan.id,
                        cycle: billingCycle,
                        key: Date.now(),
                      })
                      setChangeOpen(true)
                    }
                  : undefined
              }
              current={
                currentPlan?.id === plan.id &&
                initialBillingSummary?.subscription.cycle.toLowerCase() ===
                  billingCycle
              }
            />
          ))}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              "Trendyol ve Hepsiburada",
              "Güvenli otomatik gönderim",
              "Tüm planlarda AI performansı",
            ].map((feature) => (
              <span key={feature} className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="size-3.5 text-primary"
                />
                {feature}
              </span>
            ))}
          </div>
          <span>Vergiler ödeme adresine göre hesaplanır.</span>
        </div>
        <PlanQuestions />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>Core Asistan · Planlar ve fiyatlandırma</span>
          <span>Ödemeler Paddle güvencesiyle işlenir.</span>
        </footer>
      </div>
      {selection && (
        <PlanChangeDialog
          key={selection.key}
          workspaceId={workspaceId}
          plan={selection.plan}
          cycle={selection.cycle}
          open={changeOpen}
          onOpenChange={setChangeOpen}
        />
      )}
    </main>
  )
}
