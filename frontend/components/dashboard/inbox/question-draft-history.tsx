"use client"

import {
  ArrowDown01Icon,
  Clock01Icon,
  MagicWand01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { AiDraftAttempt, QuestionAnswerDelivery } from "@/types/question"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function QuestionDraftHistory({
  attempts,
  delivery,
}: {
  attempts: AiDraftAttempt[]
  delivery: QuestionAnswerDelivery | null
}) {
  if (attempts.length === 0) return null

  return (
    <Collapsible className="group/history overflow-hidden rounded-xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HugeiconsIcon icon={MagicWand01Icon} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              AI taslak geçmişi
            </span>
            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
              {attempts.length}
            </Badge>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Üretilen taslakları ve gönderim sonucunu inceleyin.
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/history:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-border">
          {attempts.map((attempt, index) => {
            const outcome = resolveOutcome(attempt, delivery)

            return (
              <article
                key={attempt.id}
                className={cn(
                  "px-4 py-4 sm:px-5",
                  index > 0 && "border-t border-border/70"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={outcome.variant}
                      className={cn("h-5 text-[10px]", outcome.className)}
                    >
                      {outcome.label}
                    </Badge>
                    <span className="text-xs font-medium text-foreground">
                      {attempt.trigger === "AUTOMATION"
                        ? "Otomatik oluşturuldu"
                        : attempt.requestedBy?.name
                          ? `${attempt.requestedBy.name} oluşturdu`
                          : "Kullanıcı oluşturdu"}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                    {dateFormatter.format(new Date(attempt.createdAt))}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-foreground">
                  {attempt.answer}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{attempt.model}</span>
                  <span>%{Math.round(attempt.confidence * 100)} güven</span>
                  <span>{attempt.evidenceIds.length} kanıt</span>
                  {attempt.decision === "NEEDS_REVIEW" ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      İnceleme gerekli
                    </span>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function resolveOutcome(
  attempt: AiDraftAttempt,
  delivery: QuestionAnswerDelivery | null
): {
  label: string
  variant: "outline" | "success" | "warning" | "secondary"
  className?: string
} {
  if (delivery?.draftAttemptId === attempt.id) {
    if (delivery.status === "FAILED") {
      return {
        label: "Gönderim başarısız",
        variant: "outline",
        className:
          "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/10",
      }
    }
    if (delivery.status === "QUEUED" || delivery.status === "PROCESSING") {
      return { label: "Gönderim kuyruğunda", variant: "warning" }
    }
    if (delivery.composition === "AI_EDITED") {
      return { label: "Düzenlenerek gönderildi", variant: "success" }
    }
    return {
      label:
        delivery.origin === "AUTOMATION"
          ? "Otomatik gönderildi"
          : "Değiştirilmeden gönderildi",
      variant: "success",
    }
  }

  if (attempt.outcome === "SUPERSEDED") {
    return { label: "Önceki taslak", variant: "secondary" }
  }
  if (attempt.outcome === "FAILED") {
    return {
      label: "Gönderim başarısız",
      variant: "outline",
      className:
        "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/10",
    }
  }
  if (attempt.outcome === "SELECTED") {
    return { label: "Gönderim kuyruğunda", variant: "warning" }
  }
  if (attempt.outcome === "SENT") {
    return { label: "Gönderildi", variant: "success" }
  }
  return { label: "Geçerli taslak", variant: "outline" }
}
