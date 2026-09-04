import {
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  Message01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { AiAutomationMode, StoreKnowledge } from "@/types/knowledge"

const toneLabels = {
  PROFESSIONAL: "Profesyonel",
  FRIENDLY: "Samimi",
  WARM: "Sıcak",
  MINIMAL: "Doğrudan",
} as const

const lengthLabels = {
  SHORT: "Kısa",
  BALANCED: "Dengeli",
  DETAILED: "Detaylı",
} as const

const automationLabels: Record<AiAutomationMode, string> = {
  OFF: "Manuel",
  DRAFT_ONLY: "Taslak hazırla",
  SAFE_AUTO: "Güvenli otomatik",
}

export function AiResponsePreview({
  profile,
  automationMode,
}: {
  profile: StoreKnowledge["profile"]
  automationMode: AiAutomationMode
}) {
  const answer = createPreviewAnswer(profile)

  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:sticky lg:top-5">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em]">
              Yanıt önizlemesi
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Tercihleriniz anında uygulanır.
            </p>
          </div>
        </div>
        <Badge variant="success" className="h-6 gap-1.5 px-2 text-[10px]">
          <span className="size-1.5 rounded-full bg-current" />
          Canlı
        </Badge>
      </header>

      <div className="bg-muted/25 px-4 py-5 sm:px-5">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/70 pb-3 text-[11px] text-muted-foreground">
          <span>%100 Pamuk Basic Tişört</span>
          <span className="font-medium text-foreground">Regular fit</span>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <HugeiconsIcon icon={Message01Icon} className="size-3.5" />
              Müşteri
            </p>
            <p className="ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-secondary px-3.5 py-2.5 text-sm leading-6 text-secondary-foreground">
              Bu ürün bol kesim mi?
            </p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
              <HugeiconsIcon icon={AiSparklesIcon} className="size-3.5" />
              AI taslağı
            </p>
            <p className="max-w-[94%] rounded-xl rounded-bl-sm border border-primary/15 bg-primary/7 px-3.5 py-3 text-sm leading-6 text-foreground">
              {answer}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border text-xs">
        <PreviewValue label="Ton" value={toneLabels[profile.tone]} />
        <PreviewValue
          label="Uzunluk"
          value={lengthLabels[profile.responseLength]}
          bordered
        />
        <PreviewValue
          label="Mesaj yapısı"
          value={messageStructureLabel(profile)}
          topBordered
        />
        <PreviewValue
          label="Otomasyon"
          value={automationLabels[automationMode]}
          bordered
          topBordered
        />
      </div>

      <footer className="flex items-start gap-2.5 border-t border-border bg-background px-5 py-3.5 text-xs leading-5 text-muted-foreground">
        <HugeiconsIcon
          icon={
            automationMode === "SAFE_AUTO"
              ? ShieldCheckIcon
              : CheckmarkCircle01Icon
          }
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        {automationMode === "SAFE_AUTO"
          ? "Yalnızca güven eşiğini geçen ve katalog kanıtı bulunan yanıtlar otomatik gönderilir."
          : "Gerçek yanıt ürün kanıtlarıyla oluşturulur; bu alan iletişim biçimini gösterir."}
      </footer>
    </aside>
  )
}

function PreviewValue({
  label,
  value,
  bordered = false,
  topBordered = false,
}: {
  label: string
  value: string
  bordered?: boolean
  topBordered?: boolean
}) {
  return (
    <div
      className={`px-4 py-3 ${bordered ? "border-l border-border" : ""} ${topBordered ? "border-t border-border" : ""}`}
    >
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  )
}

function messageStructureLabel(profile: StoreKnowledge["profile"]) {
  if (profile.greetingEnabled && profile.closingEnabled) {
    return "Selamlama + kapanış"
  }
  if (profile.greetingEnabled) return "Yalnızca selamlama"
  if (profile.closingEnabled) return "Yalnızca kapanış"
  return "Doğrudan cevap"
}

function createPreviewAnswer(profile: StoreKnowledge["profile"]) {
  const greeting = profile.greetingEnabled
    ? profile.tone === "FRIENDLY" || profile.tone === "WARM"
      ? "Merhaba, "
      : "Merhabalar, "
    : ""
  const shouldUseEmoji =
    profile.emojiPolicy === "ALWAYS" ||
    (profile.emojiPolicy === "WHEN_APPROPRIATE" &&
      (profile.tone === "FRIENDLY" || profile.tone === "WARM"))
  const emoji = shouldUseEmoji ? ` ${profile.preferredEmoji || "🙂"}` : ""
  const closing = profile.closingEnabled
    ? profile.tone === "WARM"
      ? " Güzel günlerde kullanmanızı dileriz."
      : profile.tone === "FRIENDLY"
        ? " Keyifli alışverişler dileriz."
        : profile.tone === "MINIMAL"
          ? " İyi günler dileriz."
          : " Keyifli alışverişler dileriz."
    : ""

  let body = "ürün bol kesim değildir; regular, yani standart kesimdir."
  if (profile.tone === "FRIENDLY") {
    body =
      "ürünümüz bol değil; regular kalıbıyla standart ve rahat bir duruşa sahiptir."
  } else if (profile.tone === "WARM") {
    body =
      "ürünümüz bol kesim değildir; regular kalıbı sayesinde dengeli ve rahat bir duruş sunar."
  } else if (profile.tone === "MINIMAL") {
    body = "ürün bol değil, regular kalıptır."
  }

  if (profile.responseLength === "DETAILED") {
    body +=
      " Kendi bedeninizi tercih ederek standart bir görünüm elde edebilirsiniz."
  }

  const resolvedBody = greeting
    ? body
    : `${body.charAt(0).toLocaleUpperCase("tr-TR")}${body.slice(1)}`

  return `${greeting}${resolvedBody}${closing}${emoji}`
}
