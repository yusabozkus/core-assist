import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

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
  const imageUrl = question.product?.images[0]?.url

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative w-full rounded-xl border p-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        selected
          ? "border-border bg-card shadow-sm"
          : "border-transparent hover:border-border/70 hover:bg-card/70"
      }`}
    >
      {selected ? (
        <span className="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}

      <span className="flex items-start gap-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={question.product?.title ?? "Ürün"}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <HugeiconsIcon icon={Package01Icon} className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-foreground">
              {question.customerName ?? "Pazaryeri müşterisi"}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {inboxDateFormatter.format(new Date(question.externalCreatedAt))}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {question.question}
          </span>
        </span>
      </span>

      <span className="mt-3 flex items-center justify-between gap-3 pl-14">
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium text-foreground/75">
            {question.product?.title ??
              `Ürün kodu: ${question.externalProductId}`}
          </span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {providerName(question.connection.providerKey)}
          </span>
        </span>
        <QuestionStatus
          status={question.status}
          deliveryStatus={question.answerDelivery?.status}
        />
      </span>
    </button>
  )
}
