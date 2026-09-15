import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { QuestionStatus } from "@/components/dashboard/inbox/question-status"
import {
  inboxDateFormatter,
  providerName,
} from "@/components/dashboard/inbox/question-inbox-utils"
import type { ProductQuestionListItem } from "@/types/question"
import { ProviderLogo } from "../channels/provider-logo"

type QuestionListItemProps = {
  question: ProductQuestionListItem
  selected: boolean
  onSelect: () => void
}

export function QuestionListItem({
  question,
  selected,
  onSelect,
}: QuestionListItemProps) {
  const productSummary = question.product ?? question.productSnapshot
  const imageUrl = productSummary?.imageUrl
  const latestDraft = question.draftAttempts?.[0]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative w-full rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        selected
          ? "border-border bg-card"
          : "border-transparent hover:border-border hover:bg-card"
      }`}
    >
      {selected ? (
        <span className="absolute top-3 bottom-3 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}

      <span className="flex items-start gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={productSummary?.title ?? "Ürün"}
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
            {productSummary?.title ??
              `Ürün kodu: ${question.externalProductId}`}
          </span>
          <div className="flex flex-row items-center gap-1">
            <ProviderLogo
              provider={question.connection.providerKey}
              className="size-3!"
            />
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {providerName(question.connection.providerKey)}
            </span>
          </div>
        </span>
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
      </span>
    </button>
  )
}
