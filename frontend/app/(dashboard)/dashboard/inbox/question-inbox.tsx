"use client"

import {
  Alert02Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  InboxIcon,
  Package01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { syncStoreQuestions } from "@/lib/api/questions"
import type { ProductQuestion, ProductQuestionStatus } from "@/types/question"

type QuestionInboxProps = {
  storeId: string
  storeName: string
  questions: ProductQuestion[]
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

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
    (question) => question.status === "PENDING"
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
            <QuestionDetail question={selectedQuestion} />
          ) : null}
        </div>
      )}
    </div>
  )
}

function QuestionListItem({
  question,
  selected,
  onSelect,
}: {
  question: ProductQuestion
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`mb-1 w-full rounded-lg border px-3 py-3 text-left transition-colors last:mb-0 ${
        selected
          ? "border-border bg-card shadow-xs"
          : "border-transparent hover:bg-muted/55"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {question.customerName ?? "Pazaryeri müşterisi"}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {dateFormatter.format(new Date(question.externalCreatedAt))}
        </span>
      </span>
      <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
        {question.question}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {providerName(question.connection.providerKey)}
        </span>
        <QuestionStatus status={question.status} />
      </span>
    </button>
  )
}

function QuestionDetail({ question }: { question: ProductQuestion }) {
  return (
    <section className="min-w-0 p-5 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-foreground">
              {question.customerName ?? "Pazaryeri müşterisi"}
            </h2>
            <Badge variant="outline">
              {providerName(question.connection.providerKey)}
            </Badge>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            {dateFormatter.format(new Date(question.externalCreatedAt))}
          </p>
        </div>
        <QuestionStatus status={question.status} />
      </div>

      <div className="py-7">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Müşteri sorusu
        </p>
        <p className="mt-3 max-w-3xl text-base leading-7 text-foreground">
          {question.question}
        </p>
      </div>

      <ProductContext question={question} />

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-4">
        <HugeiconsIcon
          icon={Alert02Icon}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Yanıtlama henüz kapalı
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Bu aşamada sorular yalnızca okunur. AI taslakları ve manuel
            yanıtlama sonraki adımda eklenecek.
          </p>
        </div>
      </div>
    </section>
  )
}

function ProductContext({ question }: { question: ProductQuestion }) {
  const imageUrl = question.product?.images[0]?.url

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        İlgili ürün
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-muted-foreground">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={question.product?.title ?? "Ürün"}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <HugeiconsIcon icon={Package01Icon} className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {question.product?.title ?? "Ürün eşleştirilemedi"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {question.product
              ? [question.product.brand, question.product.category]
                  .filter(Boolean)
                  .join(" · ")
              : `Platform ürün kodu: ${question.externalProductId}`}
          </p>
        </div>
      </div>
    </div>
  )
}

function QuestionStatus({ status }: { status: ProductQuestionStatus }) {
  const details = {
    PENDING: { label: "Bekliyor", variant: "warning" as const },
    DRAFTED: { label: "Taslak hazır", variant: "secondary" as const },
    ANSWERED: { label: "Yanıtlandı", variant: "success" as const },
    IGNORED: { label: "Yoksayıldı", variant: "secondary" as const },
  }[status]

  return (
    <Badge variant={details.variant} className="shrink-0">
      {details.label}
    </Badge>
  )
}

function InboxBadge({ label, value }: { label: string; value: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-2 border-border bg-white px-3 py-1.5 text-foreground shadow-none dark:bg-card"
    >
      <span className="size-2 rounded-full bg-emerald-500" />
      {value.toLocaleString("tr-TR")} {label}
    </Badge>
  )
}

function EmptyInbox({
  onSync,
  isSyncing,
}: {
  onSync: () => void
  isSyncing: boolean
}) {
  return (
    <section className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={InboxIcon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">
        Henüz ürün sorusu bulunmuyor
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Bağlı pazaryerlerindeki yeni ürün sorularını kontrol ederek gelen
        kutusuna aktarabilirsiniz.
      </p>
      <Button
        type="button"
        className="mt-5"
        onClick={onSync}
        disabled={isSyncing}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={`size-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Kontrol ediliyor..." : "Soruları kontrol et"}
      </Button>
    </section>
  )
}

function providerName(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}
