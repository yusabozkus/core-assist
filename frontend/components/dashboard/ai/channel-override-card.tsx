"use client"

import {
  CheckmarkCircle01Icon,
  ChevronRightIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  FeedbackBanner,
  KnowledgeTextarea,
  type SaveFeedback,
} from "@/components/dashboard/ai/settings-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ChannelKnowledgeOverride } from "@/types/knowledge"

export function ChannelOverrideCard({
  providerKey,
  value,
  feedback,
  isSaving,
  onChange,
  onSave,
}: {
  providerKey: string
  value: ChannelKnowledgeOverride
  feedback?: SaveFeedback
  isSaving: boolean
  onChange: (value: ChannelKnowledgeOverride) => void
  onSave: () => void
}) {
  const update = (
    key: Exclude<keyof ChannelKnowledgeOverride, "providerKey">,
    nextValue: string
  ) => onChange({ ...value, [key]: nextValue })
  const isCustomized = [
    value.shippingPolicy,
    value.returnPolicy,
    value.exchangePolicy,
    value.warrantyPolicy,
    value.additionalInformation,
  ].some((item) => Boolean(item?.trim()))

  return (
    <Collapsible className="group/channel-card">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors group-data-[state=open]/channel-card:border-foreground/15">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/35 sm:px-6"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold tracking-[-0.015em]">
                  {formatProvider(providerKey)}
                </h3>
                <Badge variant={isCustomized ? "success" : "secondary"}>
                  {isCustomized ? "Özelleştirildi" : "Genel ayarlar"}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                Bu pazaryerine özel kargo, iade, değişim ve garanti koşulları
              </p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <HugeiconsIcon
                icon={ChevronRightIcon}
                className="size-4 transition-transform duration-200 group-data-[state=open]/channel-card:rotate-90"
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-5 border-t border-border p-5 sm:p-6">
            <FeedbackBanner feedback={feedback} />
            <p className="rounded-lg border border-border bg-muted/25 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
              Yalnızca genel mağaza bilgisinden farklı olan koşulları girin. Boş
              bıraktığınız alanlarda genel bilgi kullanılmaya devam eder.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <KnowledgeTextarea
                label="Kargo istisnası"
                value={value.shippingPolicy ?? ""}
                onChange={(next) => update("shippingPolicy", next)}
              />
              <KnowledgeTextarea
                label="İade istisnası"
                value={value.returnPolicy ?? ""}
                onChange={(next) => update("returnPolicy", next)}
              />
              <KnowledgeTextarea
                label="Değişim istisnası"
                value={value.exchangePolicy ?? ""}
                onChange={(next) => update("exchangePolicy", next)}
              />
              <KnowledgeTextarea
                label="Garanti istisnası"
                value={value.warrantyPolicy ?? ""}
                onChange={(next) => update("warrantyPolicy", next)}
              />
            </div>
            <KnowledgeTextarea
              label="Kanala özel diğer bilgiler"
              value={value.additionalInformation ?? ""}
              onChange={(next) => update("additionalInformation", next)}
            />
          </div>
          <div className="flex justify-end border-t border-border bg-muted/15 px-5 py-3.5 sm:px-6">
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <HugeiconsIcon
                icon={isSaving ? RefreshIcon : CheckmarkCircle01Icon}
                className={`size-4 ${isSaving ? "animate-spin" : ""}`}
              />
              Kanal bilgisini kaydet
            </Button>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}

function formatProvider(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}
