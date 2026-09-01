import {
  CheckmarkCircle01Icon,
  Message01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { StoreKnowledge } from "@/types/knowledge"

export function AiResponsePreview({
  profile,
}: {
  profile: StoreKnowledge["profile"]
}) {
  const answer = createPreviewAnswer(profile)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:sticky lg:top-5">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-[-0.015em]">
              Canlı yanıt önizlemesi
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ayarlar değiştikçe örnek cevap anında güncellenir.
            </p>
          </div>
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-current" />
            Önizleme
          </Badge>
        </div>
      </div>

      <div className="bg-muted/20 p-5">
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HugeiconsIcon icon={Message01Icon} className="size-4" />
            Müşteri sorusu
          </div>
          <div className="ml-auto max-w-[88%] rounded-xl rounded-br-sm bg-secondary px-3.5 py-2.5 text-sm leading-6">
            Bu ürün bol kesim mi?
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">
              AI
            </span>
            Taslak cevap
          </div>
          <div className="max-w-[94%] rounded-xl rounded-bl-sm border border-primary/15 bg-primary/7 px-3.5 py-3 text-sm leading-6">
            {answer}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 border-t border-border px-5 py-3.5 text-xs leading-5 text-muted-foreground">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        Gerçek cevap ürün kanıtlarıyla oluşturulur. Bu alan yalnızca seçtiğiniz
        ton ve biçimi gösterir.
      </div>
    </section>
  )
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
