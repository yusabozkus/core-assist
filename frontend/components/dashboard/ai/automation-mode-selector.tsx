"use client"

import {
  AiEditingIcon,
  Edit02Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AiAutomationMode } from "@/types/knowledge"

const modes: Array<{
  value: AiAutomationMode
  label: string
  description: string
  badge?: string
  icon: IconSvgElement
}> = [
  {
    value: "OFF",
    label: "Manuel",
    description: "AI yalnızca siz taslak istediğinizde çalışır.",
    icon: Edit02Icon,
  },
  {
    value: "DRAFT_ONLY",
    label: "Taslak hazırla",
    description: "Yanıtı hazırlar; gönderim onayı sizde kalır.",
    badge: "Önerilen",
    icon: AiEditingIcon,
  },
  {
    value: "SAFE_AUTO",
    label: "Güvenli otomatik",
    description: "Yalnızca güvenli yanıtları otomatik gönderir.",
    badge: "Otomatik",
    icon: ShieldCheckIcon,
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
    <div
      role="radiogroup"
      aria-label="Yanıt otomasyonu"
      className="grid overflow-hidden rounded-lg border border-border bg-background md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-border"
    >
      {modes.map((mode) => {
        const selected = value === mode.value

        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode.value)}
            className={cn(
              "group relative flex min-h-32 w-full flex-col border-b border-border p-4 text-left transition-colors last:border-b-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset md:border-b-0",
              selected ? "bg-primary/7" : "bg-background hover:bg-muted/35"
            )}
          >
            <span className="flex w-full items-start justify-between gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border transition-colors",
                  selected
                    ? "border-primary/20 bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground group-hover:text-foreground"
                )}
              >
                <HugeiconsIcon icon={mode.icon} className="size-4" />
              </span>
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border",
                  selected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {selected ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
            </span>

            <span className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {mode.label}
              </span>
              {mode.badge ? (
                <Badge
                  variant={selected ? "default" : "secondary"}
                  className="h-5 px-1.5 text-[9px] font-semibold"
                >
                  {mode.badge}
                </Badge>
              ) : null}
            </span>
            <span className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {mode.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
