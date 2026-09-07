"use client"

import { cn } from "@/lib/utils"
import type { BillingCycle } from "@/types/billing"

export function BillingCycleToggle({
  value,
  onChange,
}: {
  value: BillingCycle
  onChange: (cycle: BillingCycle) => void
}) {
  return (
    <div
      role="group"
      aria-label="Faturalama dönemi"
      className="relative grid w-64 grid-cols-2 rounded-xl border border-border bg-muted/60 p-1"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg border border-border bg-card shadow-xs transition-transform duration-250 ease-out motion-reduce:transition-none",
          value === "annual" && "translate-x-full"
        )}
      />
      {(["monthly", "annual"] as const).map((cycle) => (
        <button
          key={cycle}
          type="button"
          aria-pressed={value === cycle}
          onClick={() => onChange(cycle)}
          className={cn(
            "relative flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === cycle
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {cycle === "monthly" ? "Aylık" : "Yıllık"}
          {cycle === "annual" && (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              −%10
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
