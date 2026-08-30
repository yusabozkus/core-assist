"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useIsDesktop } from "@/hooks/use-desktop"
import { syncStoreQuestions } from "@/lib/api/questions"
import type { ProductQuestion } from "@/types/question"

export type QuestionInboxProps = {
  storeId: string
  questions: ProductQuestion[]
}

type InboxFilter = "ALL" | "PENDING" | "ANSWERED"

const inboxFilters: Array<{ value: InboxFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "PENDING", label: "Bekleyen" },
  { value: "ANSWERED", label: "Yanıtlanan" },
]

export function QuestionInbox({ storeId, questions }: QuestionInboxProps) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    questions[0]?.id ?? null
  )
  const [filter, setFilter] = useState<InboxFilter>("ALL")
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, startSyncTransition] = useTransition()
  const pendingCount = questions.filter(
    (question) =>
      question.status !== "ANSWERED" && question.status !== "IGNORED"
  ).length
  const answeredCount = questions.filter(
    (question) => question.status === "ANSWERED"
  ).length
  const filteredQuestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")

    return questions.filter((question) => {
      const matchesFilter =
        filter === "ALL" ||
        (filter === "PENDING" &&
          question.status !== "ANSWERED" &&
          question.status !== "IGNORED") ||
        (filter === "ANSWERED" && question.status === "ANSWERED")

      if (!matchesFilter) return false
      if (!normalizedQuery) return true

      return [
        question.customerName,
        question.question,
        question.product?.title,
        question.connection.providerKey,
      ].some((value) =>
        value?.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      )
    })
  }, [filter, query, questions])
  const selectedQuestion =
    filteredQuestions.find((question) => question.id === selectedQuestionId) ??
    filteredQuestions[0] ??
    null

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
        window.setTimeout(() => router.refresh(), 1_500)
        window.setTimeout(() => router.refresh(), 3_500)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Sorular güncellenemedi."
        )
      }
    })
  }

  if (questions.length === 0) {
    return (
      <div className="h-full min-h-0 w-full">
        <EmptyInbox onSync={syncQuestions} isSyncing={isSyncing} />
      </div>
    )
  }

  const questionListPanel = (
    <aside className="flex h-full min-h-0 flex-col border-b border-border bg-muted/15 lg:border-b-0">
      <div className="shrink-0 border-b border-border bg-background p-3.5">
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Ürün soruları
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filteredQuestions.length.toLocaleString("tr-TR")} kayıt
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={syncQuestions}
            disabled={isSyncing}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Kontrol ediliyor" : "Güncelle"}
          </Button>
        </div>

        <div className="relative mt-3">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Müşteri, ürün veya soru ara"
            aria-label="Gelen kutusunda ara"
            className="h-9! bg-background pl-9"
          />
        </div>

        <div className="mt-2.5 grid grid-cols-3 rounded-lg bg-muted p-1">
          {inboxFilters.map((item) => {
            const count =
              item.value === "ALL"
                ? questions.length
                : item.value === "PENDING"
                  ? pendingCount
                  : answeredCount

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

        {error || message ? (
          <div className="mt-3 text-xs leading-5" aria-live="polite">
            {error ? <p className="text-destructive">{error}</p> : null}
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

      <div className="subtle-scrollbar max-h-[32rem] min-h-0 space-y-1 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((question) => (
            <QuestionListItem
              key={question.id}
              question={question}
              selected={question.id === selectedQuestion?.id}
              onSelect={() => setSelectedQuestionId(question.id)}
            />
          ))
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
  const questionDetailPanel = selectedQuestion ? (
    <QuestionDetail storeId={storeId} question={selectedQuestion} />
  ) : (
    <div className="hidden h-full min-h-96 items-center justify-center bg-background px-8 text-center lg:flex">
      <div>
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <HugeiconsIcon icon={InboxIcon} className="size-5" />
        </span>
        <p className="mt-4 text-sm font-medium text-foreground">
          Görüntülenecek soru yok
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Farklı bir filtre seçerek tekrar deneyin.
        </p>
      </div>
    </div>
  )

  return (
    <div className="h-full min-h-0 w-full bg-background">
      {isDesktop ? (
        <ResizablePanelGroup
          id="question-inbox-layout"
          orientation="horizontal"
          className="min-h-0"
        >
          <ResizablePanel
            id="question-list"
            defaultSize="23.5rem"
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
        <div className="min-h-full bg-background">
          {questionListPanel}
          {questionDetailPanel}
        </div>
      )}
    </div>
  )
}
