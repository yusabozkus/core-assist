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

  if (deliveryStatus === "FAILED" && !needsReview) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
          compactClassName
        )}
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
          "shrink-0 border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400",
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
        className={cn(
          "shrink-0 border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
          compactClassName
        )}
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
          "shrink-0 border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
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
        className={cn(
          "shrink-0 border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
          compactClassName
        )}
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
          "shrink-0 border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300",
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
          "shrink-0 border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
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
        className={cn(
          "shrink-0 border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-400",
          compactClassName
        )}
      >
        İnceleme bekliyor
      </Badge>
    )
  }

  if (status === "DRAFTED" && draftDecision === "READY_FOR_SEND") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-400",
          compactClassName
        )}
      >
        Gönderime hazır
      </Badge>
    )
  }

  const details = {
    PENDING: {
      label: "Bekliyor",
      className:
        "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    },
    DRAFTED: {
      label: "Taslak hazır",
      className:
        "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    },
    ANSWERED: {
      label: "Yanıtlandı",
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
    IGNORED: {
      label: "Yanıtlanmadı",
      className:
        "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
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
