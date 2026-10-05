"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { APP_ROUTES } from "@/constants/site"
import { getAiPerformanceQuestions } from "@/lib/api/ai-performance"
import type {
  AiPerformanceCursor,
  AiPerformanceDetailScope,
  AiPerformanceQuestionPage,
} from "@/types/ai-performance"
import { formatCount, reviewReasonLabels } from "./analytics-format"

export function PerformanceQuestionSheet({
  storeId,
  scope,
  onClose,
}: {
  storeId: string
  scope: AiPerformanceDetailScope
  onClose: () => void
}) {
  const [page, setPage] = useState<AiPerformanceQuestionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [returnFocus] = useState(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  )
  const controller = useRef<AbortController | null>(null)
  const failed = scope.kind === "FAILED_DELIVERY"
  const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: scope.timezone,
  })

  const fetchPage = useCallback(
    async (cursor: AiPerformanceCursor | null, signal: AbortSignal) => {
      try {
        const result = await getAiPerformanceQuestions(
          storeId,
          scope,
          cursor,
          signal
        )
        if (signal.aborted) return
        setPage((previous) =>
          cursor && previous
            ? {
                ...result,
                totals: previous.totals,
                items: [
                  ...previous.items,
                  ...result.items.filter(
                    (item) =>
                      !previous.items.some(
                        (existing) => existing.questionId === item.questionId
                      )
                  ),
                ],
              }
            : result
        )
        setError(false)
      } catch {
        if (!signal.aborted) setError(true)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [storeId, scope]
  )

  useEffect(() => {
    const request = new AbortController()
    controller.current = request
    void getAiPerformanceQuestions(storeId, scope, null, request.signal)
      .then((result) => {
        if (!request.signal.aborted) setPage(result)
      })
      .catch(() => {
        if (!request.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false)
      })
    return () => request.abort()
  }, [storeId, scope])

  function loadNext() {
    if (!controller.current || loading) return
    setLoading(true)
    setError(false)
    void fetchPage(page?.nextCursor ?? null, controller.current.signal)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus?.focus()
        }}
      >
        <SheetHeader className="shrink-0 gap-3 border-b pr-14">
          <SheetTitle>
            {failed
              ? "Gönderilemeyen yanıtlar"
              : (reviewReasonLabels[scope.reason] ?? "Ek kontrol gerekiyor")}
          </SheetTitle>
          <div className="min-h-5" aria-live="polite">
            {page ? (
              <p className="text-sm font-medium tabular-nums">
                {formatCount(page.totals.questions)} soru ·{" "}
                {formatCount(page.totals.events)}{" "}
                {failed ? "gönderim" : "taslak"}
              </p>
            ) : loading ? (
              <Skeleton className="h-5 w-36" />
            ) : null}
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-[11px]">
            {scope.provider ? (
              <ProviderLogo
                provider={scope.provider}
                title={getProviderName(scope.provider)}
                className="size-6 rounded-md shadow-none"
                sizes="24px"
              />
            ) : (
              <span>Tüm pazaryerleri ·</span>
            )}
            <span>
              {scope.from
                ? `${dateFormatter.format(new Date(scope.from))} – ${dateFormatter.format(new Date(scope.asOf))}`
                : "Tüm zamanlar"}
            </span>
          </SheetDescription>
        </SheetHeader>
        <div
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6"
          aria-busy={loading}
        >
          <ul className="divide-y divide-border">
            {page?.items.map((item) => {
              const params = new URLSearchParams({
                question: item.questionId,
                status:
                  item.status === "ANSWERED"
                    ? "ANSWERED"
                    : item.status === "IGNORED"
                      ? "IGNORED"
                      : "PENDING",
              })
              return (
                <li key={item.questionId} className="py-5 first:pt-0">
                  <Link
                    href={`${APP_ROUTES.dashboard.inbox}?${params}`}
                    className="group flex items-start gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ProviderLogo
                      provider={item.providerKey}
                      title={getProviderName(item.providerKey)}
                      className="mt-0.5 size-8 rounded-lg shadow-none"
                      sizes="32px"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <time
                          dateTime={item.lastMatchedAt}
                          className="text-[11px] text-muted-foreground"
                        >
                          {dateFormatter.format(new Date(item.lastMatchedAt))}
                        </time>
                        <QuestionStatus
                          status={item.status}
                          draftDecision={item.draftDecision}
                          draftProcessingStatus={item.draftProcessingStatus}
                          deliveryStatus={item.deliveryStatus ?? undefined}
                          compact
                        />
                      </div>
                      <p className="text-sm leading-6 font-medium transition-colors group-hover:text-primary">
                        {item.question}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.productTitle ?? "Ürün bilgisi yok"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          Soruyu aç{" "}
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className="size-3"
                          />
                        </span>
                        {!failed && item.eventCount > 1 && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatCount(item.eventCount)} taslak
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          {loading && !page && (
            <div
              className="space-y-5"
              role="status"
              aria-label="Sorular yükleniyor"
            >
              {[0, 1, 2].map((key) => (
                <div key={key} className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="mt-4 space-y-3" role="alert">
              <p className="text-sm text-muted-foreground">
                Sorular yüklenemedi. Tekrar deneyebilirsiniz.
              </p>
              <Button variant="outline" size="sm" onClick={loadNext}>
                Tekrar dene
              </Button>
            </div>
          )}
          {!loading && !error && page?.items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Bu seçimde soru bulunamadı. Gönderim durumu bu sırada değişmiş
              olabilir.
            </p>
          )}
          {!error && page?.nextCursor && (
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={loading}
              onClick={loadNext}
            >
              {loading ? "Yükleniyor…" : "Daha fazla göster"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
