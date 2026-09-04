"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AiAutomationMode } from "@/types/knowledge"

const modes: Array<{
  value: AiAutomationMode
  label: string
  description: string
  badge?: string
}> = [
  {
    value: "OFF",
    label: "Kapalı",
    description:
      "AI yalnızca Gelen Kutusu'nda Taslak oluştur dediğinizde çalışır.",
  },
  {
    value: "DRAFT_ONLY",
    label: "Yalnızca taslak",
    description:
      "Yeni ve bekleyen sorular için arka planda taslak hazırlar; gönderim onayı her zaman sizde kalır.",
    badge: "Önerilen",
  },
  {
    value: "SAFE_AUTO",
    label: "Güvenli otomatik yanıt",
    description:
      "Yalnızca doğrulanmış katalog kanıtlarına dayanan ve güven eşiğini geçen yanıtları gönderir.",
    badge: "Otomatik",
  },
]

export function AutomationModeSelector({
  value,
  onChange,
}: {
  value: AiAutomationMode
  onChange: (value: AiAutomationMode) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {modes.map((mode) => {
          const selected = value === mode.value

          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(mode.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors",
                selected
                  ? "border-primary/45 bg-primary/6"
                  : "border-border bg-background hover:border-foreground/20 hover:bg-muted/35",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/45 bg-background"
                )}
              >
                {selected ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {mode.label}
                  </span>
                  {mode.badge ? (
                    <Badge
                      variant="default"
                      className="px-2 py-0 text-[10px] leading-4"
                    >
                      {mode.badge}
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {mode.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-border bg-muted/25 px-4 py-3 text-xs leading-5 text-muted-foreground">
        {value === "DRAFT_ONLY" ? (
          <>
            Taslaklar soru senkronizasyonundan sonra sırayla hazırlanır. AI hiçbir
            yanıtı pazaryerine otomatik olarak göndermez.
          </>
        ) : value === "SAFE_AUTO" ? (
          <>
            En az %85 güvene sahip, eksik bilgisi ve risk işareti olmayan
            yanıtlar otomatik gönderilir. Diğer taslaklar incelemeniz için Gelen
            Kutusu&apos;nda kalır.
          </>
        ) : (
          <>
            Otomasyon kapalıyken mevcut manuel taslak ve cevap gönderme akışınız
            değişmeden devam eder.
          </>
        )}
      </div>
    </div>
  )
}
