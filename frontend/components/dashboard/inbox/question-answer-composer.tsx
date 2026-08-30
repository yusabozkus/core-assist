"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  MagicWand01Icon,
  RefreshIcon,
  SendIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  answerProductQuestion,
  generateProductQuestionDraft,
} from "@/lib/api/questions"
import type { ProductQuestion } from "@/types/question"

const MAX_ANSWER_LENGTH = 2000

type QuestionAnswerComposerProps = {
  storeId: string
  question: ProductQuestion
}

export function QuestionAnswerComposer({
  storeId,
  question,
}: QuestionAnswerComposerProps) {
  const router = useRouter()
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
  const isQueued =
    (optimisticQueuedAt !== null &&
      delivery?.queuedAt !== optimisticQueuedAt) ||
    delivery?.status === "QUEUED" ||
    delivery?.status === "PROCESSING"

  useEffect(() => {
    if (!isQueued) return

    const intervalId = window.setInterval(() => router.refresh(), 1_500)
    return () => window.clearInterval(intervalId)
  }, [isQueued, router])

  if (question.status === "ANSWERED" || delivery?.status === "SENT") {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
          Cevap gönderildi
        </div>
        <p className="mt-3 rounded-xl border border-border bg-muted/25 p-4 text-sm leading-6 text-foreground">
          {question.answer ?? delivery?.answer}
        </p>
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
        window.setTimeout(() => router.refresh(), 500)
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
        setAnswer(result.answer)
        router.refresh()
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Cevap taslağı oluşturulamadı."
        )
      }
    })
  }

  return (
    <form onSubmit={submitAnswer} className="mt-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          htmlFor={`question-answer-${question.id}`}
          className="text-sm font-semibold text-foreground"
        >
          Cevabınız
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {answer.length}/{MAX_ANSWER_LENGTH}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={generateDraft}
            disabled={
              isDrafting || isSubmitting || isQueued || !question.product
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
              : question.status === "DRAFTED"
                ? "Taslağı yenile"
                : "Taslak oluştur"}
          </Button>
        </div>
      </div>
      <Textarea
        id={`question-answer-${question.id}`}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        maxLength={MAX_ANSWER_LENGTH}
        rows={5}
        disabled={isSubmitting || isQueued || isDrafting}
        placeholder="Müşteriye göndermek istediğiniz cevabı yazın..."
        className="mt-3 min-h-32 resize-y"
        aria-invalid={Boolean(error || delivery?.lastError)}
      />
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
        <Button
          type="submit"
          disabled={
            isSubmitting || isQueued || isDrafting || answer.trim().length < 2
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
    </form>
  )
}
