import { Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductContext } from "@/components/dashboard/inbox/product-context"
import { QuestionAnswerComposer } from "@/components/dashboard/inbox/question-answer-composer"
import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import { ReferenceAnswer } from "@/components/dashboard/inbox/reference-answer"
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
  const customerInitial = customerName
    .trim()
    .charAt(0)
    .toLocaleUpperCase("tr-TR")

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
          <div className="flex flex-col gap-1 items-start">
            <QuestionStatus
              status={question.status}
              deliveryStatus={question.answerDelivery?.status}
            />
            <Badge variant="outline" className="bg-card font-medium">
              {providerName(question.connection.providerKey)}
              <ProviderLogo
                provider={question.connection.providerKey}
                className="size-4!" />
            </Badge>
          </div>
        </header>
      ) : null}

      <div className="themed-scrollbar bg-background px-4 py-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8 lg:py-7">
        <div className="mx-auto w-full max-w-4xl space-y-5">
          <section>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Müşteri sorusu
            </p>
            <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
              <span className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
              <p className="pl-1 text-[15px] leading-7 text-foreground">
                {question.question}
              </p>
            </div>
          </section>

          <ReferenceAnswer question={question} />

          <ProductContext question={question} />
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
