import { Badge } from "@/components/ui/badge"
import type {
  ProductQuestionStatus,
  QuestionAnswerStatus,
} from "@/types/question"

export function QuestionStatus({
  status,
  deliveryStatus,
}: {
  status: ProductQuestionStatus
  deliveryStatus?: QuestionAnswerStatus
}) {
  if (deliveryStatus === "FAILED") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-destructive/25 text-destructive"
      >
        Gönderilemedi
      </Badge>
    )
  }

  if (deliveryStatus === "QUEUED" || deliveryStatus === "PROCESSING") {
    return (
      <Badge variant="warning" className="shrink-0">
        Gönderiliyor
      </Badge>
    )
  }

  const details = {
    PENDING: { label: "Bekliyor", variant: "warning" as const },
    DRAFTED: { label: "Taslak hazır", variant: "secondary" as const },
    ANSWERED: { label: "Yanıtlandı", variant: "success" as const },
    IGNORED: { label: "Yoksayıldı", variant: "secondary" as const },
  }[status]

  return (
    <Badge variant={details.variant} className="shrink-0">
      {details.label}
    </Badge>
  )
}
