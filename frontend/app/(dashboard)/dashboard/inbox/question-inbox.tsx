"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  CheckmarkCircle01Icon,
  InboxIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { EmptyInbox } from "@/components/dashboard/inbox/empty-inbox"
import { QuestionDetail } from "@/components/dashboard/inbox/question-detail"
import { QuestionListItem } from "@/components/dashboard/inbox/question-list-item"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import {
  QuestionInboxLayoutSkeleton,
  QuestionListItemsSkeleton,
} from "@/components/skeletons/question-list-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsDesktop } from "@/hooks/use-desktop"
import { getProductQuestions, syncStoreQuestions } from "@/lib/api/questions"
import type {
  ProductQuestion,
  ProductQuestionFilter,
  ProductQuestionPage,
} from "@/types/question"

export type QuestionInboxProps = {
  storeId: string
  initialPage: ProductQuestionPage
}

const PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 300

const inboxFilters: Array<{
  value: ProductQuestionFilter
  label: string
}> = [
  { value: "ALL", label: "Tümü" },
  { value: "PENDING", label: "Bekleyen" },
  { value: "ANSWERED", label: "Yanıtlanan" },
  { value: "IGNORED", label: "Engellenen" },
]

export function QuestionInbox({ storeId, initialPage }: QuestionInboxProps) {
  const isDesktop = useIsDesktop()
  const [questions, setQuestions] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [summary, setSummary] = useState(initialPage.summary)
  const [selectedQuestion, setSelectedQuestion] =
    useState<ProductQuestion | null>(null)
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false)
  const [filter, setFilter] = useState<ProductQuestionFilter>("ALL")
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSyncing, startSyncTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const listRequestIdRef = useRef(0)
  const lastListRequestKeyRef = useRef(`${storeId}|ALL|`)

  const applyFirstPage = useCallback((page: ProductQuestionPage) => {
    setQuestions(page.items)
    setNextCursor(page.nextCursor)
    setSummary(page.summary)
  }, [])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestKey = `${storeId}|${filter}|${normalizedQuery}`

    if (requestKey === lastListRequestKeyRef.current) return

    const requestId = ++listRequestIdRef.current
    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      lastListRequestKeyRef.current = requestKey
      setIsListLoading(true)
      setListError(null)

      try {
        const page = await getProductQuestions(storeId, {
          limit: PAGE_SIZE,
          status: filter,
          query: normalizedQuery,
          signal: controller.signal,
        })

        if (requestId === listRequestIdRef.current) {
          applyFirstPage(page)
          listRef.current?.scrollTo({ top: 0 })
        }
      } catch (caughtError) {
        if (
          requestId === listRequestIdRef.current &&
          !isAbortError(caughtError)
        ) {
          setListError(
            caughtError instanceof Error
              ? caughtError.message
              : "Sorular yüklenemedi."
          )
        }
      } finally {
        if (requestId === listRequestIdRef.current) {
          setIsListLoading(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [applyFirstPage, filter, query, storeId])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isListLoading || isLoadingMore) return

    setIsLoadingMore(true)
    setListError(null)

    try {
      const page = await getProductQuestions(storeId, {
        cursor: nextCursor,
        limit: PAGE_SIZE,
        status: filter,
        query,
      })

      setQuestions((currentQuestions) =>
        appendUniqueQuestions(currentQuestions, page.items)
      )
      setNextCursor(page.nextCursor)
      setSummary(page.summary)
    } catch (caughtError) {
      setListError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer sorular yüklenemedi."
      )
    } finally {
      setIsLoadingMore(false)
    }
  }, [filter, isListLoading, isLoadingMore, nextCursor, query, storeId])

  useEffect(() => {
    const root = listRef.current
    const target = loadMoreRef.current

    if (!root || !target || !nextCursor || isListLoading) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { root, rootMargin: "180px 0px" }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [isDesktop, isListLoading, loadMore, nextCursor])

  function selectQuestion(question: ProductQuestion) {
    setSelectedQuestion(question)

    if (isDesktop === false) {
      setIsMobileDetailOpen(true)
    }
  }

  async function refreshCurrentList() {
    try {
      const page = await getProductQuestions(storeId, {
        limit: PAGE_SIZE,
        status: filter,
        query,
      })

      applyFirstPage(page)
      setSelectedQuestion((currentQuestion) => {
        if (!currentQuestion) return null

        return (
          page.items.find((question) => question.id === currentQuestion.id) ??
          currentQuestion
        )
      })
    } catch {
      // Senkronizasyon arka planda sürerken mevcut liste korunur.
    }
  }

  function syncQuestions() {
    startSyncTransition(async () => {
      setError(null)
      setMessage(null)

      try {
        const result = await syncStoreQuestions(storeId)
        setMessage(
          result.queued > 0
            ? `${result.queued} kanal için soru kontrolü başlatıldı.`
            : "Soru kontrolü zaten çalışıyor veya bağlı kanal bulunmuyor."
        )
        window.setTimeout(() => void refreshCurrentList(), 1_500)
        window.setTimeout(() => void refreshCurrentList(), 3_500)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Sorular güncellenemedi."
        )
      }
    })
  }

  if (initialPage.summary.total === 0 && summary.total === 0) {
    return (
      <div className="h-full min-h-0 w-full">
        <EmptyInbox onSync={syncQuestions} isSyncing={isSyncing} />
      </div>
    )
  }

  if (isDesktop === null) {
    return <QuestionInboxLayoutSkeleton />
  }

  const questionListPanel = (
    <aside className="relative flex h-full min-h-0 flex-col border-b border-border bg-background lg:border-b-0">
      <div className="shrink-0 border-b border-border bg-background p-3.5">
        <div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Müşteri, ürün veya soru ara"
            aria-label="Gelen kutusunda ara"
            icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
            className="h-9! bg-card"
          />
        </div>

        <div className="mt-2.5 grid grid-cols-4 rounded-lg border border-border bg-muted p-1">
          {inboxFilters.map((item) => {
            const count = filterCount(item.value, summary)

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  filter === item.value
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label} {count}
              </button>
            )
          })}
        </div>

        {error || message || listError ? (
          <div className="mt-3 text-xs leading-5" aria-live="polite">
            {error || listError ? (
              <p className="text-destructive">{error ?? listError}</p>
            ) : null}
            {message ? (
              <p className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        ref={listRef}
        className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pb-14"
      >
        {isListLoading ? (
          <QuestionListItemsSkeleton />
        ) : questions.length > 0 ? (
          <div className="space-y-1">
            {questions.map((question) => (
              <QuestionListItem
                key={question.id}
                question={question}
                selected={question.id === selectedQuestion?.id}
                onSelect={() => selectQuestion(question)}
              />
            ))}

            <div ref={loadMoreRef} className="min-h-px" aria-hidden="true" />
            {isLoadingMore ? <QuestionListItemsSkeleton count={2} /> : null}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HugeiconsIcon icon={Search01Icon} className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">
              Sonuç bulunamadı
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Arama ifadenizi veya durum filtresini değiştirin.
            </p>
          </div>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={syncQuestions}
            disabled={isSyncing}
            aria-label="Soruları güncelle"
            className="absolute bottom-3 left-3 z-10 bg-card! shadow-md"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Soruları güncelle
        </TooltipContent>
      </Tooltip>
    </aside>
  )
  const questionDetailPanel = selectedQuestion ? (
    <QuestionDetail storeId={storeId} question={selectedQuestion} />
  ) : (
    <div className="hidden h-full min-h-96 items-center justify-center bg-background px-8 text-center lg:flex">
      <div className="max-w-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-xs">
          <HugeiconsIcon icon={InboxIcon} className="size-5" />
        </span>
        <p className="mt-5 text-sm font-semibold text-foreground">
          Yanıtlamak için bir soru seçin
        </p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Müşteri sorusunu, ilgili ürün bilgilerini ve yanıt araçlarını görmek
          için soldaki listeden bir kayıt seçin.
        </p>
      </div>
    </div>
  )

  return (
    <div className="h-full min-h-0 w-full bg-background px-0 lg:px-6">
      {isDesktop ? (
        <ResizablePanelGroup
          id="question-inbox-layout"
          orientation="horizontal"
          className="min-h-0"
        >
          <ResizablePanel
            id="question-list"
            defaultSize="26rem"
            minSize="19rem"
            maxSize="32rem"
            groupResizeBehavior="preserve-pixel-size"
          >
            {questionListPanel}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="bg-border/70 transition-colors hover:bg-primary/45 focus-visible:bg-primary/45"
          />
          <ResizablePanel id="question-detail" minSize="26rem">
            {questionDetailPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="h-full min-h-0 bg-background">
          {questionListPanel}
          {selectedQuestion ? (
            <ResponsiveDialog
              open={isMobileDetailOpen}
              onOpenChange={setIsMobileDetailOpen}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {selectedQuestion.customerName ?? "Pazaryeri müşterisi"}
                  </span>
                  <QuestionStatus
                    status={selectedQuestion.status}
                    deliveryStatus={selectedQuestion.answerDelivery?.status}
                  />
                </span>
              }
              description={`${providerName(
                selectedQuestion.connection.providerKey
              )} · ${inboxDateFormatter.format(
                new Date(selectedQuestion.externalCreatedAt)
              )}`}
              bodyClassName="px-0 py-0"
            >
              <QuestionDetail
                storeId={storeId}
                question={selectedQuestion}
                showHeader={false}
              />
            </ResponsiveDialog>
          ) : null}
        </div>
      )}
    </div>
  )
}

function appendUniqueQuestions(
  currentQuestions: ProductQuestion[],
  nextQuestions: ProductQuestion[]
) {
  const questionIds = new Set(currentQuestions.map((question) => question.id))

  return [
    ...currentQuestions,
    ...nextQuestions.filter((question) => !questionIds.has(question.id)),
  ]
}

function filterCount(
  filter: ProductQuestionFilter,
  summary: ProductQuestionPage["summary"]
) {
  switch (filter) {
    case "PENDING":
      return summary.pending
    case "ANSWERED":
      return summary.answered
    case "IGNORED":
      return summary.ignored
    default:
      return summary.total
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}
