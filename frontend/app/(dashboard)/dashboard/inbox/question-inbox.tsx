"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  InboxIcon,
  MoreHorizontalIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { EmptyInbox } from "@/components/dashboard/inbox/empty-inbox"
import { QuestionDetail } from "@/components/dashboard/inbox/question-detail"
import { QuestionListItem } from "@/components/dashboard/inbox/question-list-item"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import {
  QuestionDetailSkeleton,
  QuestionInboxLayoutSkeleton,
  QuestionListItemsSkeleton,
} from "@/components/skeletons/question-list-skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  getProductQuestion,
  getProductQuestionUpdates,
  getProductQuestions,
  syncStoreQuestions,
} from "@/lib/api/questions"
import {
  PENDING_QUESTION_STATES,
  type PendingQuestionState,
  type ProductQuestion,
  type ProductQuestionFilter,
  type ProductQuestionListItem,
  type ProductQuestionListSlice,
  type ProductQuestionPage,
} from "@/types/question"

export type QuestionInboxProps = {
  storeId: string
  initialPage: ProductQuestionPage
  initialFilter: ProductQuestionFilter
  initialPendingStates: PendingQuestionState[]
}

const PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 300
const DETAIL_CACHE_TTL_MS = 60_000
const ACTIVE_REFRESH_INTERVAL_MS = 2_000
const IDLE_REFRESH_INTERVAL_MS = 10_000
const SUMMARY_REFRESH_INTERVAL_MS = 30_000
const MAX_LIVE_REFRESH_ITEMS = 50

type DetailCacheEntry = {
  question: ProductQuestion
  cachedAt: number
}

const inboxFilters: Array<{
  value: ProductQuestionFilter
  label: string
}> = [
  { value: "PENDING", label: "Bekleyen" },
  { value: "ANSWERED", label: "Yanıtlanan" },
  { value: "IGNORED", label: "Engellenen" },
]

const pendingStateOptions: Array<{
  value: PendingQuestionState
  label: string
  dotClassName: string
}> = [
  { value: "WAITING", label: "Yanıt bekliyor", dotClassName: "bg-blue-500" },
  {
    value: "DRAFT_QUEUED",
    label: "Taslak kuyruğunda",
    dotClassName: "bg-violet-500",
  },
  {
    value: "DRAFT_PROCESSING",
    label: "Taslak hazırlanıyor",
    dotClassName: "bg-violet-500",
  },
  {
    value: "REVIEW_REQUIRED",
    label: "İnceleme bekliyor",
    dotClassName: "bg-orange-500",
  },
  {
    value: "READY_TO_SEND",
    label: "Gönderime hazır",
    dotClassName: "bg-teal-500",
  },
  {
    value: "SEND_QUEUED",
    label: "Gönderim kuyruğunda",
    dotClassName: "bg-sky-500",
  },
  { value: "SENDING", label: "Gönderiliyor", dotClassName: "bg-sky-500" },
  {
    value: "BLOCKED_QUOTA",
    label: "Kota bekliyor",
    dotClassName: "bg-amber-500",
  },
  {
    value: "BLOCKED_SUBSCRIPTION",
    label: "Abonelik bekliyor",
    dotClassName: "bg-amber-500",
  },
  {
    value: "DRAFT_FAILED",
    label: "Taslak hatası",
    dotClassName: "bg-red-500",
  },
  { value: "SEND_FAILED", label: "Gönderilemedi", dotClassName: "bg-red-500" },
  {
    value: "SEND_REVIEW",
    label: "Teslimat kontrolü",
    dotClassName: "bg-amber-500",
  },
]

export function QuestionInbox({
  storeId,
  initialPage,
  initialFilter,
  initialPendingStates,
}: QuestionInboxProps) {
  const isDesktop = useIsDesktop()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = parseQuestionFilter(searchParams.get("status"))
  const pendingStateParam = searchParams.get("pending")
  const pendingStates = useMemo(
    () => parsePendingStates(pendingStateParam),
    [pendingStateParam]
  )
  const pendingStateKey = pendingStates.join(",")
  const [questions, setQuestions] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [summary, setSummary] = useState(initialPage.summary)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    searchParams.get("question")
  )
  const [selectedQuestionSummary, setSelectedQuestionSummary] =
    useState<ProductQuestionListItem | null>(null)
  const [selectedQuestion, setSelectedQuestion] =
    useState<ProductQuestion | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(
    Boolean(searchParams.get("question"))
  )
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(
    Boolean(searchParams.get("question"))
  )
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
  const lastListRequestKeyRef = useRef(
    `${storeId}|${initialFilter}|${initialPendingStates.join(",")}|`
  )
  const detailRequestIdRef = useRef(0)
  const detailAbortControllerRef = useRef<AbortController | null>(null)
  const detailCacheRef = useRef(new Map<string, DetailCacheEntry>())
  const detailRefreshInFlightRef = useRef(false)
  const liveRefreshInFlightRef = useRef(false)
  const lastSummaryRefreshAtRef = useRef(0)
  const questionsRef = useRef(initialPage.items)
  const selectedQuestionSummaryRef = useRef<ProductQuestionListItem | null>(
    null
  )

  useEffect(() => {
    lastSummaryRefreshAtRef.current = Date.now()
  }, [])

  const applyFirstPage = useCallback((page: ProductQuestionPage) => {
    questionsRef.current = page.items
    lastSummaryRefreshAtRef.current = Date.now()
    setQuestions(page.items)
    setNextCursor(page.nextCursor)
    setSummary(page.summary)
  }, [])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    selectedQuestionSummaryRef.current = selectedQuestionSummary
  }, [selectedQuestionSummary])

  const loadQuestionDetail = useCallback(
    async (questionId: string, force = false) => {
      detailAbortControllerRef.current?.abort()
      const requestId = ++detailRequestIdRef.current
      const cached = detailCacheRef.current.get(questionId)

      if (
        !force &&
        cached &&
        Date.now() - cached.cachedAt < DETAIL_CACHE_TTL_MS
      ) {
        setSelectedQuestion(cached.question)
        setDetailError(null)
        setIsDetailLoading(false)
        return cached.question
      }

      const controller = new AbortController()
      detailAbortControllerRef.current = controller

      if (!force) {
        setSelectedQuestion(null)
        setIsDetailLoading(true)
      }
      setDetailError(null)

      try {
        const question = await getProductQuestion(
          storeId,
          questionId,
          controller.signal
        )

        if (requestId !== detailRequestIdRef.current) return null

        detailCacheRef.current.set(questionId, {
          question,
          cachedAt: Date.now(),
        })
        setSelectedQuestion(question)
        setQuestions((currentQuestions) =>
          currentQuestions.map((currentQuestion) =>
            currentQuestion.id === question.id
              ? listItemFromDetail(currentQuestion, question)
              : currentQuestion
          )
        )
        setSelectedQuestionSummary((currentQuestion) =>
          currentQuestion?.id === question.id
            ? listItemFromDetail(currentQuestion, question)
            : currentQuestion
        )
        return question
      } catch (caughtError) {
        if (
          requestId === detailRequestIdRef.current &&
          !isAbortError(caughtError)
        ) {
          setDetailError(
            caughtError instanceof Error
              ? caughtError.message
              : "Soru detayları yüklenemedi."
          )
        }
        return null
      } finally {
        if (requestId === detailRequestIdRef.current) {
          setIsDetailLoading(false)
        }
      }
    },
    [storeId]
  )

  useEffect(() => {
    return () => detailAbortControllerRef.current?.abort()
  }, [])

  // Explicit overview links can open a question outside the first page.
  // Ordinary inbox visits still start without an automatic selection.
  const linkedQuestionId = searchParams.get("question")
  useEffect(() => {
    if (!linkedQuestionId) return
    let disposed = false
    void loadQuestionDetail(linkedQuestionId).then((question) => {
      if (!question || disposed) return
      setSelectedQuestionId(question.id)
      setSelectedQuestionSummary(
        listItemFromDetail(
          {
            ...question,
            product: null,
          },
          question
        )
      )
      setIsMobileDetailOpen(true)
    })
    return () => {
      disposed = true
    }
  }, [linkedQuestionId, loadQuestionDetail])

  const refreshSelectedQuestion = useCallback(async () => {
    if (!selectedQuestionId || detailRefreshInFlightRef.current) return

    detailRefreshInFlightRef.current = true
    try {
      await loadQuestionDetail(selectedQuestionId, true)
    } finally {
      detailRefreshInFlightRef.current = false
    }
  }, [loadQuestionDetail, selectedQuestionId])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestKey = `${storeId}|${filter}|${pendingStateKey}|${normalizedQuery}`

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
          pendingStates,
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
  }, [applyFirstPage, filter, pendingStateKey, pendingStates, query, storeId])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isListLoading || isLoadingMore) return

    setIsLoadingMore(true)
    setListError(null)

    try {
      const page = await getProductQuestionUpdates(storeId, {
        cursor: nextCursor,
        limit: PAGE_SIZE,
        status: filter,
        query,
        pendingStates,
      })

      setQuestions((currentQuestions) =>
        appendUniqueQuestions(currentQuestions, page.items)
      )
      setNextCursor(page.nextCursor)
    } catch (caughtError) {
      setListError(
        caughtError instanceof Error
          ? caughtError.message
          : "Diğer sorular yüklenemedi."
      )
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    filter,
    isListLoading,
    isLoadingMore,
    nextCursor,
    pendingStates,
    query,
    storeId,
  ])

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

  function selectQuestion(question: ProductQuestionListItem) {
    setSelectedQuestionId(question.id)
    setSelectedQuestionSummary(question)
    void loadQuestionDetail(question.id)

    if (isDesktop === false) {
      setIsMobileDetailOpen(true)
    }
  }

  function changeFilter(nextFilter: ProductQuestionFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextFilter === "PENDING") {
      params.delete("status")
    } else {
      params.set("status", nextFilter.toLowerCase())
    }

    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }

  function changePendingState(state: PendingQuestionState, checked: boolean) {
    const selectedStates = new Set(pendingStates)

    if (checked) {
      selectedStates.add(state)
    } else if (selectedStates.size > 1) {
      selectedStates.delete(state)
    }

    const orderedStates = PENDING_QUESTION_STATES.filter((item) =>
      selectedStates.has(item)
    )
    const params = new URLSearchParams(searchParams.toString())
    params.set(
      "pending",
      orderedStates.map((item) => item.toLowerCase()).join(",")
    )

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const refreshCurrentList = useCallback(
    async ({ includeSummary = false }: { includeSummary?: boolean } = {}) => {
      if (liveRefreshInFlightRef.current) return

      liveRefreshInFlightRef.current = true
      try {
        const loadedQuestionCount = questionsRef.current.length
        const refreshLimit = Math.min(
          Math.max(loadedQuestionCount, PAGE_SIZE),
          MAX_LIVE_REFRESH_ITEMS
        )
        const requestOptions = {
          limit: refreshLimit,
          status: filter,
          query: query.trim(),
          pendingStates,
        } as const
        let page: ProductQuestionListSlice
        if (includeSummary) {
          const pageWithSummary = await getProductQuestions(
            storeId,
            requestOptions
          )
          lastSummaryRefreshAtRef.current = Date.now()
          setSummary(pageWithSummary.summary)
          page = pageWithSummary
        } else {
          page = await getProductQuestionUpdates(storeId, requestOptions)
        }

        setQuestions((currentQuestions) => {
          if (currentQuestions.length <= refreshLimit) {
            questionsRef.current = page.items
            return page.items
          }

          const refreshedQuestionIds = new Set(
            page.items.map((question) => question.id)
          )
          const preservedTail = currentQuestions
            .slice(refreshLimit)
            .filter((question) => !refreshedQuestionIds.has(question.id))
          const nextQuestions = [...page.items, ...preservedTail]
          questionsRef.current = nextQuestions
          return nextQuestions
        })
        if (loadedQuestionCount <= refreshLimit) {
          setNextCursor(page.nextCursor)
        }
        setSelectedQuestionSummary((currentQuestion) => {
          if (!currentQuestion) return null

          const nextQuestion =
            page.items.find((question) => question.id === currentQuestion.id) ??
            currentQuestion
          selectedQuestionSummaryRef.current = nextQuestion
          return nextQuestion
        })
      } catch {
        // Senkronizasyon arka planda sürerken mevcut liste korunur.
      } finally {
        liveRefreshInFlightRef.current = false
      }
    },
    [filter, pendingStates, query, storeId]
  )

  useEffect(() => {
    let disposed = false
    let timeoutId: number | undefined
    let cycleInFlight = false

    async function refreshLiveState() {
      const activeRequestKey = `${storeId}|${filter}|${pendingStateKey}|${query.trim()}`
      if (
        document.visibilityState !== "visible" ||
        isListLoading ||
        isLoadingMore ||
        activeRequestKey !== lastListRequestKeyRef.current
      ) {
        return
      }

      const includeSummary =
        Date.now() - lastSummaryRefreshAtRef.current >=
        SUMMARY_REFRESH_INTERVAL_MS

      await refreshCurrentList({ includeSummary })

      if (isQuestionProcessing(selectedQuestionSummaryRef.current)) {
        await refreshSelectedQuestion()
      }
    }

    function scheduleNextRefresh() {
      if (disposed || document.visibilityState !== "visible") return

      const hasActiveWork = questionsRef.current.some(isQuestionProcessing)
      timeoutId = window.setTimeout(
        () => void runRefreshCycle(),
        hasActiveWork ? ACTIVE_REFRESH_INTERVAL_MS : IDLE_REFRESH_INTERVAL_MS
      )
    }

    async function runRefreshCycle() {
      if (disposed || cycleInFlight) return

      cycleInFlight = true
      try {
        await refreshLiveState()
      } finally {
        cycleInFlight = false
        scheduleNextRefresh()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
        void runRefreshCycle()
      } else if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }

    scheduleNextRefresh()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      disposed = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [
    filter,
    isListLoading,
    isLoadingMore,
    pendingStateKey,
    query,
    refreshCurrentList,
    refreshSelectedQuestion,
    storeId,
  ])

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
        window.setTimeout(
          () => void refreshCurrentList({ includeSummary: true }),
          3_500
        )
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
      <div className="shrink-0 bg-background px-3.5 pt-3.5">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Müşteri, ürün veya soru ara"
            aria-label="Gelen kutusunda ara"
            icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
            endIcon={
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Aramayı temizle"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </button>
              ) : undefined
            }
            className="h-9! min-w-0 flex-1 bg-card"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={syncQuestions}
                disabled={isSyncing}
                aria-label="Soruları güncelle"
                className="size-9 shrink-0 bg-card shadow-xs"
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Soruları güncelle
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mt-2.5 flex items-stretch border-b border-border/70">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Bekleyen durumlarını filtrele. ${pendingStates.length} durum seçili.`}
                className="relative my-1 mr-1 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground ring-2 ring-background">
                  {pendingStates.length}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-64">
              <DropdownMenuLabel>Bekleyen durumları</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pendingStateOptions.map((item) => {
                const checked = pendingStates.includes(item.value)

                return (
                  <DropdownMenuCheckboxItem
                    key={item.value}
                    checked={checked}
                    disabled={checked && pendingStates.length === 1}
                    onCheckedChange={(nextChecked) =>
                      changePendingState(item.value, nextChecked === true)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${item.dotClassName}`}
                    />
                    <span>{item.label}</span>
                  </DropdownMenuCheckboxItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="grid min-w-0 flex-1 grid-cols-3">
            {inboxFilters.map((item) => {
              const count = filterCount(item.value, summary)
              const isActive = filter === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => changeFilter(item.value)}
                  aria-pressed={isActive}
                  className={`relative flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      isActive ? "text-primary" : "text-muted-foreground/75"
                    }`}
                  >
                    {count}
                  </span>
                  {isActive ? (
                    <motion.span
                      layoutId="inbox-filter-indicator"
                      className="absolute right-2 bottom-[-1px] left-2 h-0.5 rounded-full bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 440,
                        damping: 36,
                      }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
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
        className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-2"
      >
        {isListLoading ? (
          <QuestionListItemsSkeleton />
        ) : questions.length > 0 ? (
          <div className="space-y-1">
            {questions.map((question) => (
              <QuestionListItem
                key={question.id}
                question={question}
                selected={question.id === selectedQuestionId}
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
    </aside>
  )
  function renderQuestionDetail() {
    if (isDetailLoading) {
      return <QuestionDetailSkeleton showHeader={false} />
    }

    if (selectedQuestion) {
      return (
        <QuestionDetail
          storeId={storeId}
          question={selectedQuestion}
          onQuestionUpdated={async () => {
            await Promise.all([
              refreshSelectedQuestion(),
              refreshCurrentList({ includeSummary: true }),
            ])
          }}
        />
      )
    }

    return (
      <div className="flex h-full min-h-96 items-center justify-center bg-background px-8 text-center">
        <div className="max-w-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
          </span>
          <p className="mt-5 text-sm font-semibold text-foreground">
            Soru detayları yüklenemedi
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {detailError ??
              "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."}
          </p>
          {selectedQuestionId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => void loadQuestionDetail(selectedQuestionId)}
            >
              <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
              Tekrar dene
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  const questionDetailPanel = selectedQuestionId ? (
    renderQuestionDetail()
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
          {selectedQuestionId ? (
            <ResponsiveDialog
              open={isMobileDetailOpen}
              onOpenChange={setIsMobileDetailOpen}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {selectedQuestionSummary?.customerName ??
                      "Pazaryeri müşterisi"}
                  </span>
                  {selectedQuestionSummary && (
                    <QuestionStatus
                      status={selectedQuestionSummary.status}
                      deliveryStatus={
                        selectedQuestionSummary.answerDelivery?.status
                      }
                      draftProcessingStatus={
                        selectedQuestionSummary.draftProcessingStatus
                      }
                      draftDecision={selectedQuestionSummary.draftDecision}
                      draftAnswerability={
                        selectedQuestionSummary.draftAnswerability
                      }
                    />
                  )}
                </span>
              }
              description={
                selectedQuestionSummary
                  ? `${providerName(
                      selectedQuestionSummary.connection.providerKey
                    )} · ${inboxDateFormatter.format(
                      new Date(selectedQuestionSummary.externalCreatedAt)
                    )}`
                  : "Soru detayları"
              }
              bodyClassName="px-0 py-0"
            >
              {renderQuestionDetail()}
            </ResponsiveDialog>
          ) : null}
        </div>
      )}
    </div>
  )
}

function appendUniqueQuestions(
  currentQuestions: ProductQuestionListItem[],
  nextQuestions: ProductQuestionListItem[]
) {
  const questionIds = new Set(currentQuestions.map((question) => question.id))

  return [
    ...currentQuestions,
    ...nextQuestions.filter((question) => !questionIds.has(question.id)),
  ]
}

function listItemFromDetail(
  currentQuestion: ProductQuestionListItem,
  question: ProductQuestion
): ProductQuestionListItem {
  return {
    ...currentQuestion,
    customerName: question.customerName,
    question: question.question,
    status: question.status,
    draftDecision: question.draftDecision,
    draftProcessingStatus: question.draftProcessingStatus,
    externalCreatedAt: question.externalCreatedAt,
    connection: question.connection,
    product: question.product
      ? {
          id: question.product.id,
          title: question.product.title,
          imageUrl: question.product.images[0]?.url ?? null,
        }
      : null,
    answerDelivery: question.answerDelivery
      ? { status: question.answerDelivery.status }
      : null,
  }
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

function isQuestionProcessing(question: ProductQuestionListItem | null) {
  return (
    question?.draftProcessingStatus === "QUEUED" ||
    question?.draftProcessingStatus === "PROCESSING" ||
    question?.answerDelivery?.status === "QUEUED" ||
    question?.answerDelivery?.status === "PROCESSING"
  )
}

function parseQuestionFilter(value: string | null): ProductQuestionFilter {
  const normalized = value?.toUpperCase()

  return normalized === "PENDING" ||
    normalized === "ANSWERED" ||
    normalized === "IGNORED"
    ? normalized
    : "PENDING"
}

function parsePendingStates(value: string | null): PendingQuestionState[] {
  if (!value) return [...PENDING_QUESTION_STATES]

  const requestedStates = new Set(
    value
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is PendingQuestionState =>
        PENDING_QUESTION_STATES.includes(item as PendingQuestionState)
      )
  )
  const states = PENDING_QUESTION_STATES.filter((state) =>
    requestedStates.has(state)
  )

  return states.length > 0 ? states : [...PENDING_QUESTION_STATES]
}
