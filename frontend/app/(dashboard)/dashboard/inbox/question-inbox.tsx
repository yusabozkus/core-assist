"use client"

import { CheckmarkCircle01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { EmptyInbox } from "@/components/dashboard/inbox/empty-inbox"
import { InboxBadge } from "@/components/dashboard/inbox/inbox-badge"
import { QuestionDetail } from "@/components/dashboard/inbox/question-detail"
import { QuestionListItem } from "@/components/dashboard/inbox/question-list-item"
import { Button } from "@/components/ui/button"
import { syncStoreQuestions } from "@/lib/api/questions"
import type { ProductQuestion } from "@/types/question"

export type QuestionInboxProps = {
  storeId: string
  storeName: string
  questions: ProductQuestion[]
}

export function QuestionInbox({
  storeId,
  storeName,
  questions,
}: QuestionInboxProps) {
  const router = useRouter()
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    questions[0]?.id ?? null
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, startSyncTransition] = useTransition()
  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ??
    questions[0] ??
    null
  const pendingCount = questions.filter(
    (question) =>
      question.status !== "ANSWERED" && question.status !== "IGNORED"
  ).length
  const matchedCount = questions.filter((question) => question.product).length

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

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Gelen Kutusu
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasının pazaryerlerinden gelen ürün sorularını tek
            yerde takip edin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <InboxBadge label="Soru" value={questions.length} />
            <InboxBadge label="Bekleyen" value={pendingCount} />
            <InboxBadge label="Ürünle eşleşen" value={matchedCount} />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={syncQuestions}
          disabled={isSyncing}
          className="sm:self-center"
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-4 ${isSyncing ? "animate-spin" : ""}`}
          />
          {isSyncing ? "Kontrol ediliyor..." : "Soruları güncelle"}
        </Button>
      </div>

      {error || message ? (
        <div className="mb-4 text-sm" aria-live="polite">
          {error ? <p className="text-destructive">{error}</p> : null}
          {message ? (
            <p className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
              {message}
            </p>
          ) : null}
        </div>
      ) : null}

      {questions.length === 0 ? (
        <EmptyInbox onSync={syncQuestions} isSyncing={isSyncing} />
      ) : (
        <div className="grid min-h-[34rem] overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/15 lg:border-r lg:border-b-0">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ürün soruları
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 lg:max-h-[calc(100vh-19rem)]">
              {questions.map((question) => (
                <QuestionListItem
                  key={question.id}
                  question={question}
                  selected={question.id === selectedQuestion?.id}
                  onSelect={() => setSelectedQuestionId(question.id)}
                />
              ))}
            </div>
          </aside>

          {selectedQuestion ? (
            <QuestionDetail storeId={storeId} question={selectedQuestion} />
          ) : null}
        </div>
      )}
    </div>
  )
}
