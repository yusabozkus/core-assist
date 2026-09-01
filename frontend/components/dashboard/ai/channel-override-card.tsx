"use client"

import { CheckmarkCircle01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  FeedbackBanner,
  KnowledgeTextarea,
  type SaveFeedback,
  SettingsCard,
} from "@/components/dashboard/ai/settings-card"
import { Button } from "@/components/ui/button"
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

  return (
    <SettingsCard
      title={formatProvider(providerKey)}
      description="Yalnızca bu kanalda genel mağaza bilgisinden farklı olan koşulları girin. Boş alanlarda genel bilgi kullanılır."
      action={
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <HugeiconsIcon
            icon={isSaving ? RefreshIcon : CheckmarkCircle01Icon}
            className={`size-4 ${isSaving ? "animate-spin" : ""}`}
          />
          Kanal bilgisini kaydet
        </Button>
      }
    >
      <FeedbackBanner feedback={feedback} />
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
    </SettingsCard>
  )
}

function formatProvider(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}
