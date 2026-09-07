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
import { PlanSelectionDialog } from "@/components/dashboard/billing/plan-selection-dialog"
import { PlanQuestions } from "@/components/dashboard/billing/plan-questions"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Button } from "@/components/ui/button"
import { BILLING_PREVIEW, SUBSCRIPTION_PLANS } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import type { BillingCycle, SubscriptionPlan } from "@/types/billing"

export function PlansClient() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    BILLING_PREVIEW.cycle
  )
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null
  )
  return (
    <main className="themed-scrollbar fixed inset-0 z-40 overflow-y-auto overscroll-y-contain bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95">
        <div className="mx-auto flex h-18 w-full max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <AppLogo href={APP_ROUTES.dashboard.settings.billing} />
          <div className="flex items-center gap-5">
            <span className="hidden text-xs text-muted-foreground sm:block">
              Mevcut planınız{" "}
              <span className="ml-1 font-medium text-foreground">
                {BILLING_PREVIEW.plan.name}
              </span>
            </span>
            <Button
              asChild
              variant="outline"
              size="icon-sm"
              className="bg-card"
            >
              <Link
                href={APP_ROUTES.dashboard.settings.billing}
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
              Her planda 7 gün ücretsiz deneme
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              İşinize uygun kapasiteyi seçin.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Sorularınız, mağazalarınız ve kataloğunuz için ihtiyacınız kadar
              alan. Tüm planlarda aynı kolay kullanım.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2.5 lg:items-end">
            <BillingCycleToggle
              value={billingCycle}
              onChange={setBillingCycle}
            />
            <p className="text-xs text-muted-foreground">
              {billingCycle === "annual"
                ? "Yıllık ödemede %10 tasarruf edin."
                : "Yıllık ödemeyi seçin, %10 daha az ödeyin."}
            </p>
          </div>
        </section>
        <section
          aria-label="Abonelik planları"
          className="grid items-stretch gap-4 lg:grid-cols-3"
        >
          {SUBSCRIPTION_PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              onSelect={setSelectedPlan}
            />
          ))}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              "Trendyol ve Hepsiburada",
              "Ürün bilgileriyle desteklenen yanıtlar",
              "Mobil uyumlu gelen kutusu",
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
          <span>Fiyatlara KDV dahil değildir.</span>
        </div>
        <PlanQuestions />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
          <span>CoreAssist · Planlar ve fiyatlandırma</span>
          <span>Örnek görünüm · Henüz ödeme alınmaz.</span>
        </footer>
      </div>
      <PlanSelectionDialog
        plan={selectedPlan}
        billingCycle={billingCycle}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null)
        }}
      />
    </main>
  )
}
