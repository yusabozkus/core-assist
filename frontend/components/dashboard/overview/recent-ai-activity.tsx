import { Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import type { AiPerformance } from "@/types/ai-performance"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function RecentAiActivity({
  activity,
}: {
  activity: AiPerformance["recentActivity"]
}) {
  if (activity.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-semibold tracking-[-0.015em] text-foreground">
          Son AI işlemleri
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          En son üretilen taslakların güncel sonucu.
        </p>
      </header>

      <div className="divide-y divide-border">
        {activity.map((item) => {
          const outcome = resolveOutcome(item)

          return (
            <article
              key={item.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
            >
              <ProviderLogo
                provider={item.providerKey}
                className="hidden size-9 rounded-lg sm:flex"
                sizes="36px"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="max-w-2xl truncate text-sm font-medium text-foreground">
                    {item.question}
                  </p>
                  <Badge
                    variant={outcome.variant}
                    className="h-5 px-2 text-[10px]"
                  >
                    {outcome.label}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.productTitle ?? "Ürün eşleşmesi bulunmuyor"}
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
                <span className="text-xs font-medium text-foreground tabular-nums">
                  %{formatPercent(item.confidence * 100)} güven
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                  {dateFormatter.format(new Date(item.createdAt))}
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function resolveOutcome(item: AiPerformance["recentActivity"][number]): {
  label: string
  variant: "outline" | "success" | "warning" | "secondary"
} {
  if (item.deliveryStatus === "FAILED" || item.outcome === "FAILED") {
    return { label: "Başarısız", variant: "outline" }
  }
  if (
    item.deliveryStatus === "QUEUED" ||
    item.deliveryStatus === "PROCESSING" ||
    item.outcome === "SELECTED"
  ) {
    return { label: "Kuyrukta", variant: "warning" }
  }
  if (item.composition === "AI_EDITED") {
    return { label: "Düzenlenerek gönderildi", variant: "success" }
  }
  if (item.outcome === "SENT") {
    return {
      label:
        item.trigger === "AUTOMATION" ? "Otomatik gönderildi" : "Gönderildi",
      variant: "success",
    }
  }
  if (item.outcome === "SUPERSEDED") {
    return { label: "Yenilendi", variant: "secondary" }
  }
  if (item.automationMode === "SHADOW") {
    return item.autoSendEligible
      ? { label: "Otomatik gönderirdi", variant: "success" }
      : { label: "İncelemede kalırdı", variant: "warning" }
  }
  return {
    label:
      item.decision === "NEEDS_REVIEW" ? "İnceleme gerekli" : "Taslak hazır",
    variant: item.decision === "NEEDS_REVIEW" ? "warning" : "outline",
  }
}

function formatPercent(value: number) {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })
}
