import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import type { ProductQuestion } from "@/types/question"

type QuestionListItemProps = {
  question: ProductQuestion
  selected: boolean
  onSelect: () => void
}

export function QuestionListItem({
  question,
  selected,
  onSelect,
}: QuestionListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`mb-1 w-full rounded-lg border px-3 py-3 text-left transition-colors last:mb-0 ${selected ? "border-border bg-card shadow-xs" : "border-transparent hover:bg-muted/55"}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {question.customerName ?? "Pazaryeri müşterisi"}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {inboxDateFormatter.format(new Date(question.externalCreatedAt))}
        </span>
      </span>
      <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
        {question.question}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {providerName(question.connection.providerKey)}
        </span>
        <QuestionStatus
          status={question.status}
          deliveryStatus={question.answerDelivery?.status}
        />
      </span>
    </button>
  )
}
