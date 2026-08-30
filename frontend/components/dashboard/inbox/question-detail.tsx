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
            {inboxDateFormatter.format(new Date(question.externalCreatedAt))}
          </p>
        </div>
        <QuestionStatus
          status={question.status}
          deliveryStatus={question.answerDelivery?.status}
        />
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
      <QuestionAnswerComposer
        key={question.id}
        storeId={storeId}
        question={question}
      />
    </section>
  )
}
