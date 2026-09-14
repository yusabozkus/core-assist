import { Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductContext } from "@/components/dashboard/inbox/product-context"
import { QuestionAnswerComposer } from "@/components/dashboard/inbox/question-answer-composer"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import { Badge } from "@/components/ui/badge"
import type { ProductQuestion } from "@/types/question"
import { ProviderLogo } from "../channels/provider-logo"

export function QuestionDetail({
  storeId,
  question,
  showHeader = true,
  onQuestionUpdated,
}: {
  storeId: string
  question: ProductQuestion
  showHeader?: boolean
  onQuestionUpdated?: () => void | Promise<void>
}) {
  const customerName = question.customerName ?? "Pazaryeri müşterisi"
  const latestDraft = question.draftAttempts?.[0]
  const customerInitial = customerName
    .trim()
    .charAt(0)
    .toLocaleUpperCase("tr-TR")
  const deliveredAnswer =
    question.status === "ANSWERED" || question.answerDelivery?.status === "SENT"
      ? (question.answer ?? question.answerDelivery?.answer)
      : null

  return (
    <section className="flex min-w-0 flex-col bg-background lg:h-full lg:min-h-0">
      {showHeader ? (
        <header className="flex shrink-0 flex-col gap-4 border-b border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
              {customerInitial}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">
                {customerName}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                {inboxDateFormatter.format(
                  new Date(question.externalCreatedAt)
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1">
            <QuestionStatus
              status={question.status}
              deliveryStatus={question.answerDelivery?.status}
              draftProcessingStatus={question.draftProcessingStatus}
              draftDecision={question.draftDecision}
              shadowEligible={
                latestDraft?.automationMode === "SHADOW" &&
                latestDraft.autoSendEligible
              }
            />
            <Badge variant="outline" className="bg-card font-medium">
              {providerName(question.connection.providerKey)}
              <ProviderLogo
                provider={question.connection.providerKey}
                className="size-4!"
              />
            </Badge>
          </div>
        </header>
      ) : null}

      <div className="themed-scrollbar bg-background px-4 py-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:py-7">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex items-end gap-2.5 sm:gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
              {customerInitial}
            </span>
            <div className="max-w-[88%] sm:max-w-[78%]">
              <p className="mb-1.5 ml-1 text-[11px] font-medium text-muted-foreground">
                {customerName}
              </p>
              <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 shadow-xs sm:px-5 sm:py-3.5">
                <p className="text-[15px] leading-7 text-foreground">
                  {question.question}
                </p>
              </div>
            </div>
          </div>

          <div className="sm:ml-11">
            <ProductContext question={question} />
          </div>

          {deliveredAnswer ? (
            <div className="flex justify-end">
              <div className="max-w-[88%] sm:max-w-[78%]">
                <p className="mr-1 mb-1.5 text-right text-[11px] font-medium text-muted-foreground">
                  {question.answerDelivery?.origin === "AUTOMATION"
                    ? "Core Asistan"
                    : "Mağaza yanıtı"}
                </p>
                <p className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-7 text-primary-foreground shadow-sm sm:px-5 sm:py-3.5">
                  {deliveredAnswer}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <QuestionAnswerComposer
        key={question.id}
        storeId={storeId}
        question={question}
        onQuestionUpdated={onQuestionUpdated}
      />
    </section>
  )
}
