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
import { QuestionDraftHistory } from "@/components/dashboard/inbox/question-draft-history"
import { useBillingUsage } from "@/components/dashboard/billing/billing-usage-provider"
import { AiQuotaDialog } from "@/components/dashboard/billing/ai-quota-dialog"
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
  const [isQuotaDialogOpen, setIsQuotaDialogOpen] = useState(false)
  const [optimisticQueuedAt, setOptimisticQueuedAt] = useState<string | null>(
    null
  )
  const [isSubmitting, startSubmitTransition] = useTransition()
  const [isDrafting, startDraftTransition] = useTransition()
  const [draftRetrySeconds, setDraftRetrySeconds] = useState(0)
  const [draftContext, setDraftContext] =
    useState<DraftReliabilityContext | null>(() =>
      createPersistedDraftContext(question)
    )
  const [policyBlocked, setPolicyBlocked] = useState(false)
  const { refresh: refreshBillingUsage } = useBillingUsage()
  const isQueued =
    (optimisticQueuedAt !== null &&
      delivery?.queuedAt !== optimisticQueuedAt) ||
    delivery?.status === "QUEUED" ||
    delivery?.status === "PROCESSING"

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
        <div className="mx-auto max-w-5xl rounded-xl border border-border bg-card p-4">
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
            {delivery?.origin === "AUTOMATION"
              ? "AI tarafından otomatik gönderildi"
              : "Cevap gönderildi"}
          </div>
          <QuestionDraftHistory
            attempts={question.draftAttempts ?? []}
            delivery={question.answerDelivery}
          />
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
        void refreshBillingUsage()
        void onQuestionUpdated?.()
      } catch (caughtError) {
        if (
          caughtError instanceof ApiError &&
          caughtError.code === "AI_QUESTION_QUOTA_EXCEEDED"
        ) {
          setIsQuotaDialogOpen(true)
          void refreshBillingUsage()
          return
        }

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
    <>
      <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3.5 backdrop-blur-sm sm:px-6 lg:px-8">
        <form onSubmit={submitAnswer} className="mx-auto w-full max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`question-answer-${question.id}`}
              className="text-sm font-semibold text-foreground"
            >
              Cevabınız
            </label>
            <div className="flex items-center gap-2">
              {question.draftAttempts?.length ? (
                <QuestionDraftHistory
                  attempts={question.draftAttempts}
                  delivery={question.answerDelivery}
                />
              ) : null}
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {answer.length}/{MAX_ANSWER_LENGTH}
              </span>
            </div>
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] focus-within:border-primary/35 focus-within:shadow-sm">
            <div className="relative">
              <Textarea
                id={`question-answer-${question.id}`}
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value)
                  setDraftContext(null)
                }}
                maxLength={MAX_ANSWER_LENGTH}
                rows={3}
                disabled={isSubmitting || isQueued || isDrafting}
                placeholder="Müşteriye göndermek istediğiniz cevabı yazın..."
                className="subtle-scrollbar h-32 max-h-32 min-h-32 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-4 pt-3 pb-16 shadow-none focus-visible:ring-0"
                aria-invalid={Boolean(error || delivery?.lastError)}
              />
              <div className="pointer-events-none absolute inset-x-px bottom-px flex justify-end bg-gradient-to-t from-card via-card/95 to-transparent px-3 pt-5 pb-2.5">
                <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:flex sm:items-center">
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
                    className="bg-card/95 backdrop-blur-sm"
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
                    className="shadow-sm"
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
            </div>
            {draftContext ? (
              <DraftReliabilityNotice context={draftContext} />
            ) : null}
            {error || delivery?.status === "FAILED" || isQueued ? (
              <div
                className="border-t border-border/70 px-3.5 py-2 text-[11px] leading-4"
                aria-live="polite"
              >
                {error ? <p className="text-destructive">{error}</p> : null}
                {!error && delivery?.status === "FAILED" ? (
                  <p className="text-destructive">
                    {delivery.lastError ??
                      "Cevap gönderilemedi. Tekrar deneyebilirsiniz."}
                  </p>
                ) : null}
                {!error && isQueued ? (
                  <p className="text-muted-foreground">
                    Cevap gönderim kuyruğunda işleniyor.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
      </div>
      <AiQuotaDialog
        open={isQuotaDialogOpen}
        onOpenChange={setIsQuotaDialogOpen}
      />
    </>
  )
}

function DraftReliabilityNotice({
  context,
}: {
  context: DraftReliabilityContext
}) {
  const needsReview = context.decision === "NEEDS_REVIEW"
  const isShadowMode = context.autoSend.mode === "SHADOW"

  if (context.answerability === "OUT_OF_SCOPE") {
    return (
      <div
        className="border-t border-slate-500/20 bg-slate-500/[0.07] px-3.5 py-2.5 text-[11px] text-slate-800 dark:text-slate-200"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          <span className="font-semibold">Kapsam dışı</span>
        </div>
        <p className="mt-1.5 leading-4 text-muted-foreground">
          {needsReview
            ? "Soru ürün ve alışveriş kapsamı dışında görünüyor. Göndermeden önce sınıflandırmayı kontrol edin."
            : "Soru ürün ve alışveriş kapsamı dışında olduğu için güvenli bir yönlendirme yanıtı hazırlandı."}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`border-t px-3.5 py-2.5 text-[11px] ${
        needsReview
          ? "border-amber-500/20 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100"
          : "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-950 dark:text-emerald-100"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <HugeiconsIcon
          icon={needsReview ? AlertCircleIcon : CheckmarkCircle01Icon}
          className="size-3.5 shrink-0"
        />
        <span className="font-semibold">
          {needsReview ? "İnceleme gerekli" : "Yanıt doğrulandı"}
        </span>
        <Badge
          variant={needsReview ? "warning" : "success"}
          className="h-5 px-1.5 text-[10px]"
        >
          %{Math.round(context.confidence * 100)} güven
        </Badge>
        <span className="text-muted-foreground">
          {context.usedEvidenceIds.length} kaynak
        </span>
      </div>
      {context.missingInformation.length > 0 ? (
        <p className="mt-1.5 leading-4">
          Eksik bilgi: {context.missingInformation.join(", ")}.
        </p>
      ) : needsReview ? (
        <p className="mt-1.5 leading-4">
          Taslak yeterince desteklenmeyen bir ifade içerebilir.
        </p>
      ) : (
        <p className="mt-1.5 leading-4">
          {isShadowMode
            ? context.autoSend.eligible
              ? "Otomatik gönderime uygun; son onayınızı bekliyor."
              : "Göndermeden önce kullanıcı kontrolü gerekiyor."
            : "Katalog bilgileriyle desteklenen bir yanıt hazırlandı."}
        </p>
      )}
    </div>
  )
}

function createPersistedDraftContext(
  question: ProductQuestion
): DraftReliabilityContext | null {
  if (
    question.status !== "DRAFTED" ||
    (question.draftDecision !== "READY_FOR_SEND" &&
      question.draftDecision !== "NEEDS_REVIEW") ||
    question.draftConfidence === null
  ) {
    return null
  }

  return {
    attemptId: question.draftAttempts?.[0]?.id ?? "",
    requestedFacts: question.draftAttempts?.[0]?.requestedFacts ?? [],
    matchedColor: null,
    matchedSize: null,
    matchingVariantCount: 0,
    source: "GEMINI",
    model: question.draftModel ?? "",
    interpretation: "",
    detectedFacts: [],
    answerability: question.draftAnswerability ?? "INSUFFICIENT",
    decision: question.draftDecision,
    confidence: question.draftConfidence,
    missingInformation: question.draftMissingInformation ?? [],
    usedEvidenceIds: question.draftEvidenceIds ?? [],
    risks: question.draftRisks ?? [],
    autoSend: {
      eligible: question.draftAttempts?.[0]?.autoSendEligible ?? false,
      mode: question.draftAttempts?.[0]?.automationMode ?? "OFF",
      appliedConfidenceThreshold:
        question.draftAttempts?.[0]?.appliedConfidenceThreshold ?? 0.85,
      reasons: question.draftAttempts?.[0]?.eligibilityReasons ?? [],
    },
  }
}
