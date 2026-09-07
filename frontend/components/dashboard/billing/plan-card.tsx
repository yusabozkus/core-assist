"use client"

import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { BILLING_PREVIEW } from "@/constants/billing"
import { getPlanPrice } from "@/lib/billing"
import { cn } from "@/lib/utils"
import type { BillingCycle, SubscriptionPlan } from "@/types/billing"

export function PlanCard({
  plan,
  billingCycle,
  onSelect,
}: {
  plan: SubscriptionPlan
  billingCycle: BillingCycle
  onSelect: (plan: SubscriptionPlan) => void
}) {
  const reducedMotion = useReducedMotion()
  const price = getPlanPrice(plan, billingCycle)
  const current =
    plan.id === BILLING_PREVIEW.plan.id &&
    billingCycle === BILLING_PREVIEW.cycle
  const limits = [
    { label: "Mağaza", value: plan.stores.toLocaleString("tr-TR") },
    {
      label: "Pazaryeri bağlantısı",
      value: plan.connections?.toLocaleString("tr-TR") ?? "Sınırsız",
    },
    { label: "Katalog ürünü", value: plan.products.toLocaleString("tr-TR") },
  ]
  return (
    <article
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card",
        plan.highlighted
          ? "border-primary/50 ring-1 ring-primary/15"
          : "border-border"
      )}
    >
      <div
        className={cn(
          "flex h-9 items-center justify-between border-b px-6 text-[11px]",
          plan.highlighted
            ? "border-primary/15 bg-primary/8 text-primary"
            : "border-border bg-muted/20 text-muted-foreground"
        )}
      >
        <span>
          {plan.highlighted
            ? "Büyüyen operasyonlar için"
            : plan.id === "starter"
              ? "İlk mağazanız için"
              : "Yüksek hacimli ekipler için"}
        </span>
        {plan.id === BILLING_PREVIEW.plan.id && (
          <span className="font-medium">Planınız</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground lg:min-h-18 xl:min-h-12">
          {plan.description}
        </p>
        <div className="mt-7">
          <p
            className="flex items-baseline gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="sr-only">{price.monthly} / ay</span>
            <span
              aria-hidden="true"
              className="relative inline-grid overflow-hidden py-1 text-4xl font-semibold tracking-[-0.055em] tabular-nums"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={billingCycle}
                  className="[grid-area:1/1]"
                  initial={{ y: reducedMotion ? 0 : -25, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: reducedMotion ? 0 : 25, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.22 }}
                >
                  {price.monthly}
                </motion.span>
              </AnimatePresence>
            </span>
            <span aria-hidden="true" className="text-sm text-muted-foreground">
              / ay
            </span>
          </p>
          <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
            {billingCycle === "annual"
              ? `Yıllık ${price.total} + KDV. ${price.saving} tasarruf edin.`
              : "Aylık faturalandırılır. Fiyatlara KDV dahil değildir."}
          </p>
        </div>
        <Button
          type="button"
          variant={plan.highlighted ? "default" : "outline"}
          disabled={current}
          onClick={() => onSelect(plan)}
          className="mt-5 w-full justify-between shadow-none"
        >
          {current ? "Mevcut planınız" : "Planı seç"}
          <HugeiconsIcon
            icon={current ? CheckmarkCircle01Icon : ArrowRight01Icon}
            className="size-4"
          />
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          İlk abonelikte 7 gün ücretsiz deneme
        </p>
        <div className="mt-6 border-y border-border py-4">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {plan.questions.toLocaleString("tr-TR")}{" "}
            <span className="text-xs font-normal tracking-normal text-muted-foreground">
              soru / ay
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            AI ile yanıtlanabilecek ürün soruları
          </p>
        </div>
        <dl className="my-5 space-y-3">
          {limits.map((limit) => (
            <div
              key={limit.label}
              className="flex justify-between gap-3 text-xs"
            >
              <dt className="text-muted-foreground">{limit.label}</dt>
              <dd className="font-medium tabular-nums">{limit.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-auto space-y-3 border-t border-border pt-5">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-xs leading-5"
            >
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon}
                className="mt-0.5 size-3.5 shrink-0 text-primary"
              />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
