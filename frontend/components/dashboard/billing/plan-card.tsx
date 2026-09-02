import {
  CalendarCheck01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type BillingCycle = "monthly" | "annual"

export type SubscriptionPlan = {
  id: "starter" | "growth" | "business"
  name: string
  description: string
  monthlyPrice: number
  features: readonly string[]
  highlighted?: boolean
  current?: boolean
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})

export function PlanCard({
  plan,
  billingCycle,
  onSelect,
}: {
  plan: SubscriptionPlan
  billingCycle: BillingCycle
  onSelect: (plan: SubscriptionPlan) => void
}) {
  const isAnnual = billingCycle === "annual"
  const displayedMonthlyPrice = isAnnual
    ? plan.monthlyPrice * 0.9
    : plan.monthlyPrice
  const annualTotal = displayedMonthlyPrice * 12

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-200 sm:p-6",
        plan.highlighted
          ? "border-primary/45 shadow-lg ring-1 shadow-primary/6 ring-primary/10"
          : "border-border hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg"
      )}
    >
      {plan.highlighted ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em]">
            {plan.name}
          </h2>
          <p className="mt-1.5 min-h-10 text-sm leading-5 text-muted-foreground">
            {plan.description}
          </p>
        </div>
        {plan.current ? (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-current" />
            Mevcut
          </Badge>
        ) : plan.highlighted ? (
          <Badge>En popüler</Badge>
        ) : null}
      </div>

      <div className="mt-6">
        {isAnnual ? (
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground line-through">
              {currencyFormatter.format(plan.monthlyPrice)}
            </span>
            <span className="font-semibold text-primary">%10 indirimli</span>
          </div>
        ) : (
          <div className="mb-1.5 h-4" aria-hidden="true" />
        )}
        <p className="text-3xl font-semibold tracking-[-0.045em] text-foreground">
          {currencyFormatter.format(displayedMonthlyPrice)}
          <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
            / ay
          </span>
        </p>
        <p className="mt-2 min-h-5 text-xs text-muted-foreground">
          {isAnnual
            ? `${currencyFormatter.format(annualTotal)} yıllık faturalandırılır`
            : "Aylık olarak faturalandırılır"}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-foreground">
        <HugeiconsIcon
          icon={CalendarCheck01Icon}
          className="size-4 shrink-0 text-primary"
        />
        İlk abonelikte 7 gün ücretsiz
      </div>

      {plan.current ? (
        <div className="mt-5 flex h-11 w-full items-center justify-center rounded-xl border border-primary/20 bg-primary/8 text-sm font-medium text-primary">
          Planınız aktif
        </div>
      ) : (
        <Button
          type="button"
          variant={plan.highlighted ? "default" : "outline"}
          className="mt-5 w-full"
          onClick={() => onSelect(plan)}
        >
          7 gün ücretsiz dene
        </Button>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
          Dahil olanlar
        </p>
        <ul className="mt-4 space-y-3">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-sm leading-5 text-foreground"
            >
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon}
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle) {
  const monthlyPrice =
    cycle === "annual" ? plan.monthlyPrice * 0.9 : plan.monthlyPrice

  return {
    monthly: currencyFormatter.format(monthlyPrice),
    billed:
      cycle === "annual"
        ? `${currencyFormatter.format(monthlyPrice * 12)} / yıl`
        : `${currencyFormatter.format(monthlyPrice)} / ay`,
  }
}
