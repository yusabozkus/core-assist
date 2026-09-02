"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  MagicWand01Icon,
  RefreshIcon,
  SendIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import {
  answerProductQuestion,
  generateProductQuestionDraft,
} from "@/lib/api/questions"
import type {
  DraftQuestionAnswerResult,
  ProductQuestion,
} from "@/types/question"

const MAX_ANSWER_LENGTH = 2000
type DraftReliabilityContext = Extract<
  DraftQuestionAnswerResult,
  { status: "DRAFTED" }
>["context"]

type QuestionAnswerComposerProps = {
  storeId: string
  question: ProductQuestion
  onQuestionUpdated?: () => void | Promise<void>
}

export function QuestionAnswerComposer({
  storeId,
  question,
  onQuestionUpdated,
}: QuestionAnswerComposerProps) {
  const delivery = question.answerDelivery
  const [answer, setAnswer] = useState(
    delivery?.status === "FAILED"
      ? delivery.answer
      : question.status === "DRAFTED"
        ? (question.answer ?? "")
        : ""
  )
  const [error, setError] = useState<string | null>(null)
  const [optimisticQueuedAt, setOptimisticQueuedAt] = useState<string | null>(
    null
  )
  const [isSubmitting, startSubmitTransition] = useTransition()
  const [isDrafting, startDraftTransition] = useTransition()
  const [draftRetrySeconds, setDraftRetrySeconds] = useState(0)
  const [draftContext, setDraftContext] =
    useState<DraftReliabilityContext | null>(null)
  const [policyBlocked, setPolicyBlocked] = useState(false)
  const isQueued =
    (optimisticQueuedAt !== null &&
      delivery?.queuedAt !== optimisticQueuedAt) ||
    delivery?.status === "QUEUED" ||
    delivery?.status === "PROCESSING"

  useEffect(() => {
    if (!isQueued || !onQuestionUpdated) return

    const intervalId = window.setInterval(() => void onQuestionUpdated(), 1_500)
    return () => window.clearInterval(intervalId)
  }, [isQueued, onQuestionUpdated])

  useEffect(() => {
    if (draftRetrySeconds <= 0) return

    const timeoutId = window.setTimeout(
      () => setDraftRetrySeconds((seconds) => Math.max(0, seconds - 1)),
      1_000
    )
    return () => window.clearTimeout(timeoutId)
  }, [draftRetrySeconds])

  if (question.status === "IGNORED" || policyBlocked) {
    return (
      <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Yanıt oluşturulmadı
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Mesaj açık küfür veya doğrudan hakaret içerdiği için
                yanıtlanmayacak olarak işaretlendi. Bu karar AI tarafından
                değil, sabit içerik politikasıyla verildi.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (question.status === "ANSWERED" || delivery?.status === "SENT") {
    return (
      <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
            Cevap gönderildi
          </div>
          <p className="mt-3 rounded-xl border border-border bg-card p-4 text-sm leading-6 text-foreground">
            {question.answer ?? delivery?.answer}
          </p>
        </div>
      </div>
    )
  }

  function submitAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedAnswer = answer.trim()

    if (normalizedAnswer.length < 2) {
      setError("Cevap en az 2 karakter olmalıdır.")
      return
    }

    startSubmitTransition(async () => {
      setError(null)

      try {
        const result = await answerProductQuestion(
          storeId,
          question.id,
          normalizedAnswer
        )
        setOptimisticQueuedAt(result.queuedAt)
        window.setTimeout(() => void onQuestionUpdated?.(), 500)
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Cevap gönderim kuyruğuna eklenemedi."
        )
      }
    })
  }

  function generateDraft() {
    startDraftTransition(async () => {
      setError(null)

      try {
        const result = await generateProductQuestionDraft(storeId, question.id)
        if (result.status === "IGNORED") {
          setAnswer("")
          setDraftContext(null)
          setPolicyBlocked(true)
          void onQuestionUpdated?.()
          return
        }
        setAnswer(result.answer)
        setDraftContext(result.context)
        void onQuestionUpdated?.()
      } catch (caughtError) {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 429 &&
          caughtError.retryAfterSeconds
        ) {
          setDraftRetrySeconds(caughtError.retryAfterSeconds)
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Cevap taslağı oluşturulamadı."
        )
      }
    })
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6 lg:px-8">
      <form onSubmit={submitAnswer} className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`question-answer-${question.id}`}
            className="text-sm font-semibold text-foreground"
          >
            Cevabınız
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {answer.length}/{MAX_ANSWER_LENGTH}
          </span>
        </div>
        <Textarea
          id={`question-answer-${question.id}`}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          maxLength={MAX_ANSWER_LENGTH}
          rows={4}
          disabled={isSubmitting || isQueued || isDrafting}
          placeholder="Müşteriye göndermek istediğiniz cevabı yazın..."
          className="mt-2.5 min-h-24 resize-y bg-card"
          aria-invalid={Boolean(error || delivery?.lastError)}
        />
        {draftContext ? (
          <DraftReliabilityNotice context={draftContext} />
        ) : null}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs" aria-live="polite">
            {error ? <p className="text-destructive">{error}</p> : null}
            {!error && delivery?.status === "FAILED" ? (
              <p className="text-destructive">
                {delivery.lastError ??
                  "Cevap gönderilemedi. Tekrar deneyebilirsiniz."}
              </p>
            ) : null}
            {!error && isQueued ? (
              <p className="text-muted-foreground">
                Cevap güvenli gönderim kuyruğunda işleniyor.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={generateDraft}
              disabled={
                isDrafting ||
                isSubmitting ||
                isQueued ||
                !question.product ||
                draftRetrySeconds > 0
              }
              title={
                question.product
                  ? undefined
                  : "Taslak için sorunun bir ürünle eşleşmesi gerekir."
              }
            >
              <HugeiconsIcon
                icon={isDrafting ? RefreshIcon : MagicWand01Icon}
                className={`size-3.5 ${isDrafting ? "animate-spin" : ""}`}
              />
              {isDrafting
                ? "Hazırlanıyor..."
                : draftRetrySeconds > 0
                  ? `${draftRetrySeconds} sn sonra dene`
                  : question.status === "DRAFTED"
                    ? "Taslağı yenile"
                    : "Taslak oluştur"}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                isQueued ||
                isDrafting ||
                answer.trim().length < 2
              }
            >
              <HugeiconsIcon
                icon={isQueued ? RefreshIcon : SendIcon}
                className={`size-4 ${isQueued ? "animate-spin" : ""}`}
              />
              {isQueued
                ? "Gönderiliyor..."
                : delivery?.status === "FAILED"
                  ? "Tekrar gönder"
                  : "Cevabı gönder"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function DraftReliabilityNotice({
  context,
}: {
  context: DraftReliabilityContext
}) {
  const needsReview = context.decision === "NEEDS_REVIEW"

  return (
    <div
      className={`mt-3 rounded-lg border px-3.5 py-3 text-xs ${
        needsReview
          ? "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <HugeiconsIcon
          icon={needsReview ? AlertCircleIcon : CheckmarkCircle01Icon}
          className="size-4 shrink-0"
        />
        <span className="font-semibold">
          {needsReview
            ? "Göndermeden önce inceleyin"
            : "Katalog verileriyle desteklendi"}
        </span>
        <Badge variant={needsReview ? "warning" : "success"}>
          %{Math.round(context.confidence * 100)} güven
        </Badge>
        <span className="text-muted-foreground">
          {context.usedEvidenceIds.length} kanıt kullanıldı
        </span>
      </div>
      {context.missingInformation.length > 0 ? (
        <p className="mt-2 leading-5">
          Eksik bilgi: {context.missingInformation.join(", ")}.
        </p>
      ) : needsReview ? (
        <p className="mt-2 leading-5">
          Taslak riskli veya yeterince desteklenmeyen bir ifade içerebilir.
        </p>
      ) : null}
    </div>
  )
}
