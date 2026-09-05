import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"
import type { DashboardOverview, DashboardQueueState } from "@/types/dashboard"
import {
  dashboardNumber as number,
  queuePresentation,
} from "./dashboard-format"

const queueOrder: DashboardQueueState[] = [
  "READY",
  "REVIEW",
  "PROCESSING",
  "PENDING",
  "UNMATCHED",
  "FAILED",
]
const modeLabels = {
  OFF: "Manuel yanıt",
  SHADOW: "Otomatik taslak",
  SAFE_AUTO: "Otomatik gönderim",
}

export function DashboardQueue({ data }: { data: DashboardOverview }) {
  return (
    <section
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
      aria-labelledby="queue-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="queue-title" className="text-sm font-semibold">
          Bekleyen işler
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Anlık özet
        </span>
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tracking-tight tabular-nums">
          {number.format(data.queue.total)}
        </strong>
        <span className="text-xs text-muted-foreground">
          soru yanıt bekliyor
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {queueOrder.map(
          (state) =>
            data.queue.counts[state] > 0 && (
              <span
                key={state}
                className={queuePresentation[state].dot}
                style={{
                  width: `${(data.queue.counts[state] / data.queue.total) * 100}%`,
                }}
              />
            )
        )}
      </div>
      <div className="mt-5 mb-6 grid grid-cols-2 gap-x-5 gap-y-3.5">
        {queueOrder.map((state) => (
          <div
            key={state}
            className="flex min-w-0 items-center justify-between gap-2 text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className={`size-1.5 shrink-0 rounded-full ${queuePresentation[state].dot}`}
              />
              {queuePresentation[state].label}
            </span>
            <span className="font-medium tabular-nums">
              {number.format(data.queue.counts[state])}
            </span>
          </div>
        ))}
      </div>
      <Link
        href={APP_ROUTES.dashboard.automations.root}
        className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <span className="mb-1 block text-[10px] text-muted-foreground">
            Yanıt modu
          </span>
          <span className="font-medium">{modeLabels[data.automationMode]}</span>
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4 text-muted-foreground"
        />
      </Link>
    </section>
  )
}
