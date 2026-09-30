import { AiSparklesIcon, Message01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getPreferredEmojis } from "@/lib/emoji-preferences"
import type { StoreKnowledge } from "@/types/knowledge"

export function AiResponsePreview({
  profile,
}: {
  profile: StoreKnowledge["profile"]
}) {
  const answer = createPreviewAnswer(profile)

  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card shadow-xs xl:sticky xl:top-6">
      <header className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">
          Örnek yanıt
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Seçimlerinizin metne etkisini burada görün.
        </p>
      </header>

      <div className="bg-muted/25 px-4 py-5 sm:px-5">
        <div className="mb-5 border-b border-border/70 pb-3 text-xs text-muted-foreground">
          Örnek ürün · Regular fit tişört
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
            <p
              aria-live="polite"
              className="max-w-[94%] rounded-xl rounded-bl-sm border border-primary/15 bg-primary/7 px-3.5 py-3 text-sm leading-6 text-foreground"
            >
              {answer}
            </p>
          </div>
        </div>
      </div>
    </aside>
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
  const emoji = shouldUseEmoji
    ? ` ${getPreferredEmojis(profile.preferredEmoji)[0] || "🙂"}`
    : ""
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

  if (profile.responseLength !== "SHORT") {
    body += " Standart bir görünüm için kendi bedeninizi tercih edebilirsiniz."
  }
  if (profile.responseLength === "DETAILED") {
    body += " Regular kalıp vücuda çok dar veya çok bol oturmaz."
  }

  const resolvedBody = greeting
    ? body
    : `${body.charAt(0).toLocaleUpperCase("tr-TR")}${body.slice(1)}`

  return `${greeting}${resolvedBody}${closing}${emoji}`
}
