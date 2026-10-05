import { Badge } from "@/components/ui/badge"
import { AiSparklesIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type {
  ProductQuestionStatus,
  QuestionAnswerStatus,
  QuestionDraftProcessingStatus,
  QuestionReplyDecision,
} from "@/types/question"
import { cn } from "@/lib/utils"
import { questionStatusTones } from "./question-status-tones"

export function QuestionStatus({
  status,
  deliveryStatus,
  draftProcessingStatus,
  draftDecision,
  draftAnswerability,
  shadowEligible = false,
  compact = false,
}: {
  status: ProductQuestionStatus
  deliveryStatus?: QuestionAnswerStatus
  draftProcessingStatus?: QuestionDraftProcessingStatus | null
  draftDecision?: QuestionReplyDecision | null
  draftAnswerability?:
    "FULL" | "PARTIAL" | "INSUFFICIENT" | "OUT_OF_SCOPE" | null
  shadowEligible?: boolean
  compact?: boolean
}) {
  const compactClassName = compact
    ? "h-5 gap-1 px-1.5 py-0 text-[10px] font-medium"
    : undefined

  const needsReview = status === "DRAFTED" && draftDecision === "NEEDS_REVIEW"

  if (deliveryStatus === "REVIEW_REQUIRED") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0",
          questionStatusTones.deliveryReview,
          compactClassName
        )}
      >
        Teslimat kontrolü
      </Badge>
    )
  }

  if (deliveryStatus === "FAILED" && !needsReview) {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0", questionStatusTones.failed, compactClassName)}
      >
        Gönderilemedi
      </Badge>
    )
  }

  if (deliveryStatus === "QUEUED" || deliveryStatus === "PROCESSING") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0",
          questionStatusTones.deliveryPending,
          compactClassName
        )}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={cn("animate-spin", compact ? "size-2.5" : "size-3")}
        />
        {deliveryStatus === "QUEUED" ? "Gönderim kuyruğunda" : "Gönderiliyor"}
      </Badge>
    )
  }

  if (
    draftProcessingStatus === "QUEUED" ||
    draftProcessingStatus === "PROCESSING"
  ) {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0", questionStatusTones.draft, compactClassName)}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={cn("animate-spin", compact ? "size-2.5" : "size-3")}
        />
        {draftProcessingStatus === "QUEUED"
          ? "Taslak kuyruğunda"
          : "Taslak hazırlanıyor"}
      </Badge>
    )
  }

  if (
    draftProcessingStatus === "BLOCKED_QUOTA" ||
    draftProcessingStatus === "BLOCKED_SUBSCRIPTION"
  ) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0",
          questionStatusTones.blocked,
          compactClassName
        )}
      >
        {draftProcessingStatus === "BLOCKED_QUOTA"
          ? "Kota bekliyor"
          : "Abonelik bekliyor"}
      </Badge>
    )
  }

  if (draftProcessingStatus === "FAILED") {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0", questionStatusTones.failed, compactClassName)}
      >
        Taslak hatası
      </Badge>
    )
  }

  if (status === "DRAFTED" && draftAnswerability === "OUT_OF_SCOPE") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0",
          questionStatusTones.outOfScope,
          compactClassName
        )}
      >
        {needsReview ? "Kapsam dışı · İncele" : "Kapsam dışı"}
      </Badge>
    )
  }

  if (status === "DRAFTED" && shadowEligible && !needsReview) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0",
          questionStatusTones.shadowEligible,
          compactClassName
        )}
      >
        <HugeiconsIcon
          icon={AiSparklesIcon}
          className={compact ? "size-2.5" : "size-3"}
        />
        Otomatik gönderime uygun
      </Badge>
    )
  }

  if (needsReview) {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0", questionStatusTones.review, compactClassName)}
      >
        İnceleme bekliyor
      </Badge>
    )
  }

  if (status === "DRAFTED" && draftDecision === "READY_FOR_SEND") {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0", questionStatusTones.ready, compactClassName)}
      >
        Gönderime hazır
      </Badge>
    )
  }

  const details = {
    PENDING: {
      label: "Bekliyor",
      className: questionStatusTones.pending,
    },
    DRAFTED: {
      label: "Taslak hazır",
      className: questionStatusTones.draft,
    },
    ANSWERED: {
      label: "Yanıtlandı",
      className: questionStatusTones.answered,
    },
    IGNORED: {
      label: "Yanıtlanmadı",
      className: questionStatusTones.failed,
    },
  }[status]

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0", details.className, compactClassName)}
    >
      {details.label}
    </Badge>
  )
}
