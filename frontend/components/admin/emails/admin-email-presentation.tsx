import { Badge } from "@/components/ui/badge"
import type {
  AdminEmail,
  EmailDeliveryStatus,
  EmailSendStatus,
} from "@/types/admin-email"

const neutral = "border-border text-muted-foreground"
const success =
  "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
const warning =
  "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
const danger = "border-destructive/20 bg-destructive/10 text-destructive"

export const EMAIL_SEND_STATUS: Record<
  EmailSendStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Bekliyor", className: warning },
  SENT: { label: "Resend kabul etti", className: neutral },
  FAILED: { label: "Gönderilemedi", className: danger },
  REVIEW_REQUIRED: { label: "İnceleme gerekiyor", className: warning },
}

export const EMAIL_DELIVERY_STATUS: Record<
  EmailDeliveryStatus,
  { label: string; className: string }
> = {
  UNKNOWN: { label: "Teslimat bilinmiyor", className: neutral },
  SENT: { label: "Teslimat bekleniyor", className: neutral },
  DELAYED: { label: "Teslimat gecikti", className: warning },
  DELIVERED: { label: "Alıcı sunucusuna teslim edildi", className: success },
  FAILED: { label: "Teslimat başarısız", className: danger },
  SUPPRESSED: { label: "Gönderim engellendi", className: danger },
  BOUNCED: { label: "Geri döndü", className: danger },
  COMPLAINED: { label: "Spam şikâyeti", className: danger },
}

export function EmailStatusBadges({
  email,
}: {
  email: Pick<AdminEmail, "status" | "deliveryStatus">
}) {
  const send = EMAIL_SEND_STATUS[email.status]
  const delivery = EMAIL_DELIVERY_STATUS[email.deliveryStatus]
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className={send.className}>
        {send.label}
      </Badge>
      {email.status === "SENT" || email.deliveryStatus !== "UNKNOWN" ? (
        <Badge variant="outline" className={delivery.className}>
          {delivery.label}
        </Badge>
      ) : null}
    </div>
  )
}

export function formatEmailDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(new Date(value))
    : "—"
}

export function emailTypeLabel(type: string | null) {
  if (type === "ADMIN_ANNOUNCEMENT") return "Toplu duyuru"
  if (type === "TEAM_INVITATION") return "Ekip daveti"
  if (type === "TEAM_EVENT") return "Ekip güncellemesi"
  if (type?.startsWith("BILLING_")) return "Abonelik ve ödeme"
  if (type?.startsWith("AI_") || type === "ANSWER_DELIVERY_FAILED")
    return "AI ve yanıtlar"
  if (type === "LOW_STOCK" || type === "OUT_OF_STOCK") return "Stok bildirimi"
  if (type?.includes("SYNC") || type?.startsWith("CHANNEL_"))
    return "Kanal ve senkronizasyon"
  if (type?.startsWith("SECURITY_") || type?.startsWith("ACCOUNT_"))
    return "Hesap güvenliği"
  return "Sistem bildirimi"
}
