import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"

export function PerformanceMetric({
  icon,
  label,
  value,
  description,
  progress,
  tone = "primary",
}: {
  icon: IconSvgElement
  label: string
  value: string
  description: string
  progress?: number
  tone?: "primary" | "emerald" | "amber" | "blue"
}) {
  return (
    <section className="flex min-h-40 flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            toneClasses[tone].icon
          )}
        >
          <HugeiconsIcon icon={icon} className="size-4" />
        </span>
      </div>
      <div className="mt-auto pt-5">
        {progress !== undefined ? (
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", toneClasses[tone].bar)}
              style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
            />
          </div>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </section>
  )
}

const toneClasses = {
  primary: { icon: "bg-primary/10 text-primary", bar: "bg-primary" },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
  },
} as const
