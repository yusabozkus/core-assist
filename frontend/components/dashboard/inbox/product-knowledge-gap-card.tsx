"use client"

import { useState } from "react"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError } from "@/lib/api/client"
import { resolveProductQuestionKnowledge } from "@/lib/api/questions"
import type { CatalogProductVariant } from "@/types/product"
import type { ProductKnowledgeGap } from "@/types/question"

const PRODUCT_SCOPE = "PRODUCT"

export function ProductKnowledgeGapCard({
  storeId,
  questionId,
  gap,
  variants,
  onResolved,
}: {
  storeId: string
  questionId: string
  gap: ProductKnowledgeGap
  variants: CatalogProductVariant[]
  onResolved?: () => void | Promise<void>
}) {
  const [value, setValue] = useState("")
  const [scope, setScope] = useState(PRODUCT_SCOPE)
  const [isSaving, setIsSaving] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeVariants = variants.filter(
    (variant) =>
      variant.status !== "ARCHIVED" && variant.status !== "UNAVAILABLE"
  )

  async function saveKnowledge() {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      setError("Ürün bilgisini yazın.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await resolveProductQuestionKnowledge(storeId, questionId, {
        gapKey: gap.key,
        value: normalizedValue,
        variantId: scope === PRODUCT_SCOPE ? undefined : scope,
        confirmUnusualValue: needsConfirmation,
      })
      await onResolved?.()
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        caughtError.code === "PRODUCT_KNOWLEDGE_CONFIRMATION_REQUIRED"
      ) {
        setNeedsConfirmation(true)
        return
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ürün bilgisi kaydedilemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-5 font-medium text-foreground">
          {gap.label}
        </p>
        {gap.affectedQuestionCount > 1 ? (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
            {gap.affectedQuestionCount} soru
          </span>
        ) : null}
      </div>

      <Input
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setNeedsConfirmation(false)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            void saveKnowledge()
          }
        }}
        disabled={isSaving}
        placeholder={knowledgePlaceholder(gap.factType)}
        aria-label={`${gap.label} için doğrulanmış ürün bilgisi`}
        className="mt-3 h-9 bg-background"
      />

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Select value={scope} onValueChange={setScope} disabled={isSaving}>
          <SelectTrigger className="h-9 w-full min-w-0 border-border bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={PRODUCT_SCOPE}>Tüm ürün</SelectItem>
            {activeVariants.map((variant) => (
              <SelectItem key={variant.id} value={variant.id}>
                {variantLabel(variant)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          disabled={isSaving || !value.trim()}
          onClick={() => void saveKnowledge()}
          aria-label={
            needsConfirmation ? "Bilgiyi onaylayıp kaydet" : "AI'a öğret"
          }
        >
          <HugeiconsIcon
            icon={isSaving ? Loading03Icon : AiSparklesIcon}
            className={`size-3.5 ${isSaving ? "animate-spin" : ""}`}
          />
          {isSaving ? "Kaydediliyor" : needsConfirmation ? "Onayla" : "Öğret"}
        </Button>
      </div>

      {needsConfirmation ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-800 dark:text-amber-200">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-px size-3 shrink-0"
          />
          Değer olağan dışı görünüyor. Doğruysa tekrar onaylayın.
        </p>
      ) : error ? (
        <p role="alert" className="mt-2 text-[11px] leading-4 text-destructive">
          {error}
        </p>
      ) : gap.affectedQuestionCount > 1 ? (
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Kaydedildiğinde bekleyen ilgili sorular yeniden değerlendirilecek.
        </p>
      ) : null}
    </div>
  )
}

function variantLabel(variant: CatalogProductVariant) {
  const details = [variant.size, variant.color, variant.title]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, values) => values.indexOf(value) === index)

  return details.length > 0
    ? `${details.join(" · ")} · ${variant.sku}`
    : variant.sku
}

function knowledgePlaceholder(factType: ProductKnowledgeGap["factType"]) {
  switch (factType) {
    case "CARE":
      return "Örn. 30 °C’de ters çevirerek yıkayın"
    case "MATERIAL":
      return "Örn. %100 pamuk"
    case "FIT":
      return "Örn. Regular kalıptır"
    case "COLOR":
      return "Örn. Kırık beyaz"
    default:
      return "Örn. 34 cm"
  }
}
