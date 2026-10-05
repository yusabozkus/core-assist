import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import type { AiPerformance } from "@/types/ai-performance"
import {
  activityStatus,
  confidenceExplanation,
  formatPercent,
} from "./analytics-format"
import { MetricHelp } from "./metric-help"

export function AiActivityList({
  activity,
  timezone,
}: {
  activity: AiPerformance["recentActivity"]
  timezone: string
}) {
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
  return (
    <section
      aria-labelledby="ai-activity-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h2 id="ai-activity-title" className="text-sm font-semibold">
            Son AI işlemleri
          </h2>
          <MetricHelp
            label="AI güven puanı"
            description={confidenceExplanation}
          />
        </div>
        <Link
          href={APP_ROUTES.dashboard.inbox}
          className="hidden items-center gap-1 text-xs font-medium text-primary hover:underline sm:inline-flex"
        >
          Gelen kutusu
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </header>
      {activity.length ? (
        <div className="divide-y divide-border/60 border-t border-border/60">
          {activity.map((item) => {
            const status = activityStatus(item)
            return (
              <Link
                key={item.id}
                href={`${APP_ROUTES.dashboard.inbox}?question=${encodeURIComponent(item.questionId)}`}
                className="group flex items-start gap-3 px-5 py-4 transition-colors outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
              >
                <ProviderLogo
                  provider={item.providerKey}
                  className="mt-1 size-8 rounded-lg"
                  sizes="32px"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs leading-5 font-medium">
                        {item.question}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        {item.productTitle ?? "Ürün eşleşmedi"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`h-5 w-fit shrink-0 gap-1 px-1.5 py-0 text-[10px] font-medium ${status.tone}`}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span>{item.customerName ?? "Pazaryeri müşterisi"}</span>
                    <time dateTime={item.createdAt}>
                      {dateFormatter.format(new Date(item.createdAt))}
                    </time>
                    {item.answerability !== "OUT_OF_SCOPE" ? (
                      <span className="tabular-nums">
                        {formatPercent(item.confidence * 100)} AI güveni
                      </span>
                    ) : null}
                  </div>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="my-auto hidden size-3.5 shrink-0 text-muted-foreground sm:block"
                />
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="px-6 pb-8 text-center text-xs text-muted-foreground">
          Bu döneme ait taslak yok.
        </p>
      )}
    </section>
  )
}
