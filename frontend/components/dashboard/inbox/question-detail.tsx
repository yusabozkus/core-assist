import {
  AiSparklesIcon,
  Clock01Icon,
  Package01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { ProductContext } from "@/components/dashboard/inbox/product-context"
import { ProductKnowledgeGapCard } from "@/components/dashboard/inbox/product-knowledge-gap-card"
import { QuestionAnswerComposer } from "@/components/dashboard/inbox/question-answer-composer"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import { Badge } from "@/components/ui/badge"
import type { ProductQuestion } from "@/types/question"

export function QuestionDetail({
  storeId,
  question,
  onQuestionUpdated,
}: {
  storeId: string
  question: ProductQuestion
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
  const knowledgeGaps = question.knowledgeGaps ?? []

  return (
    <section className="flex min-w-0 flex-col bg-background lg:h-full lg:min-h-0">
      <div className="themed-scrollbar bg-background px-4 py-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:py-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[2_1_28rem] space-y-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15">
                  {customerInitial}
                </span>
                <div className="max-w-[88%] min-w-0 sm:max-w-[85%]">
                  <div className="mb-2 ml-1 flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold tracking-tight text-foreground">
                      {customerName}
                    </p>
                    <QuestionStatus
                      status={question.status}
                      deliveryStatus={question.answerDelivery?.status}
                      draftProcessingStatus={question.draftProcessingStatus}
                      draftDecision={question.draftDecision}
                      draftAnswerability={question.draftAnswerability}
                      shadowEligible={
                        latestDraft?.automationMode === "SHADOW" &&
                        latestDraft.autoSendEligible
                      }
                      compact
                    />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-border/80 bg-card px-4 py-3 shadow-sm sm:px-5 sm:py-3.5">
                    <p className="text-[15px] leading-7 text-foreground">
                      {question.question}
                    </p>
                  </div>
                  <div className="mt-2 ml-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Clock01Icon} className="size-3" />
                      {inboxDateFormatter.format(
                        new Date(question.externalCreatedAt)
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1.5">
                      <ProviderLogo
                        provider={question.connection.providerKey}
                        className="size-3.5!"
                      />
                      {providerName(question.connection.providerKey)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm:ml-12">
                <div className="mb-2.5 flex items-center gap-2 px-0.5">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <HugeiconsIcon icon={Package01Icon} className="size-3.5" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    İlgili ürün
                  </h3>
                </div>
                <ProductContext
                  storeId={storeId}
                  question={question}
                  onProductUpdated={onQuestionUpdated}
                />
              </div>

              {deliveredAnswer ? (
                <div className="flex justify-end">
                  <div className="max-w-[88%] sm:max-w-[85%]">
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

            {knowledgeGaps.length > 0 ? (
              <aside className="min-w-0 flex-[1_1_20rem]">
                <section className="overflow-hidden rounded-2xl border border-amber-500/25 bg-card shadow-xs">
                  <div className="flex items-start gap-2.5 bg-amber-500/[0.08] px-4 py-3.5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      <HugeiconsIcon
                        icon={AiSparklesIcon}
                        className="size-3.5"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          AI için eksik bilgi
                        </h3>
                        <Badge
                          variant="warning"
                          className="h-5 min-w-5 px-1.5 text-[10px] tabular-nums"
                        >
                          {knowledgeGaps.length}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        AI’nin güvenli yanıt vermesi için doğrulayın.
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/70">
                    {knowledgeGaps.map((gap) => (
                      <ProductKnowledgeGapCard
                        key={gap.key}
                        storeId={storeId}
                        questionId={question.id}
                        gap={gap}
                        variants={question.product?.variants ?? []}
                        onResolved={onQuestionUpdated}
                      />
                    ))}
                  </div>
                </section>
              </aside>
            ) : null}
          </div>
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
