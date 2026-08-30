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

export function QuestionDetail({
  storeId,
  question,
}: {
  storeId: string
  question: ProductQuestion
}) {
  const customerName = question.customerName ?? "Pazaryeri müşterisi"
  const customerInitial = customerName
    .trim()
    .charAt(0)
    .toLocaleUpperCase("tr-TR")

  return (
    <section className="min-w-0 bg-background lg:h-full lg:overflow-y-auto">
      <header className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {customerInitial}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-semibold text-foreground">
                {customerName}
              </h2>
              <Badge variant="outline" className="font-medium">
                {providerName(question.connection.providerKey)}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
              {inboxDateFormatter.format(new Date(question.externalCreatedAt))}
            </p>
          </div>
        </div>
        <QuestionStatus
          status={question.status}
          deliveryStatus={question.answerDelivery?.status}
        />
      </header>

      <div className="px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-3xl">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Müşteri sorusu
            </p>
            <div className="mt-3 rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
              <p className="text-[15px] leading-7 text-foreground">
                {question.question}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <ProductContext question={question} />
          </div>

          <QuestionAnswerComposer
            key={question.id}
            storeId={storeId}
            question={question}
          />
        </div>
      </div>
    </section>
  )
}
