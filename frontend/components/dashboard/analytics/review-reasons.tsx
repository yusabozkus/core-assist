"use client"

import { useState } from "react"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, reviewReasonLabels } from "./analytics-format"

export function ReviewReasons({
  data,
  onInspect,
}: {
  data: AiPerformance
  onInspect: (reason: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const reasons = expanded ? data.reviewReasons : data.reviewReasons.slice(0, 5)
  const maxCount = Math.max(
    ...data.reviewReasons.map((reason) => reason.count),
    1
  )

  return (
    <section
      aria-labelledby="review-reasons-title"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="review-reasons-title"
          className="scroll-mt-24 text-sm font-semibold"
        >
          İncelemeye ayrılma nedenleri
        </h2>
        <span className="text-xs text-muted-foreground">
          Dönemde {formatCount(data.draftDecisions.needsReview)} taslak
        </span>
      </header>
      {reasons.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] text-muted-foreground">
            İlgili soruları görmek için bir neden seçin.
          </p>
          <ul className="space-y-1">
            {reasons.map((reason) => (
              <li key={reason.key}>
                <button
                  type="button"
                  onClick={() => onInspect(reason.key)}
                  className="group w-full rounded-lg px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${reviewReasonLabels[reason.key] ?? "Ek kontrol"}: ${formatCount(reason.count)} taslak, soruları görüntüle`}
                >
                  <span className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium group-hover:text-primary">
                      {reviewReasonLabels[reason.key] ?? "Ek kontrol gerekiyor"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {formatCount(reason.count)}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-3.5 text-muted-foreground group-hover:text-primary"
                      />
                    </span>
                  </span>
                  <span
                    className="block h-1.5 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-chart-3"
                      style={{ width: `${(reason.count / maxCount) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {data.reviewReasons.length > 5 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expanded ? "Daha az göster" : "Tüm nedenleri göster"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-9 text-center">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            className="size-7 text-primary"
          />
          <p className="text-xs text-muted-foreground">
            Bu dönemde kaydedilmiş inceleme nedeni yok.
          </p>
        </div>
      )}
      <p className="mt-auto border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
        Bir taslakta birden fazla neden bulunabilir. Sayılar taslak adedini
        gösterir.
      </p>
    </section>
  )
}
