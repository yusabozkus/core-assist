"use client"

import { useState } from "react"
import {
  AiSparklesIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ApiError } from "@/lib/api/client"
import {
  archiveProductKnowledgeFact,
  updateProductKnowledgeFact,
} from "@/lib/api/catalog"
import type { CatalogProductKnowledgeFact } from "@/types/product"

export function ProductKnowledgeSection({
  storeId,
  facts,
  onUpdated,
}: {
  storeId: string
  facts: CatalogProductKnowledgeFact[]
  onUpdated?: () => void | Promise<void>
}) {
  if (facts.length === 0) return null

  return (
    <section className="px-5 py-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={AiSparklesIcon} className="size-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              AI&apos;a öğretilen bilgiler
            </h3>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Satıcının doğruladığı ve ürün yanıtlarında kullanılan bilgiler.
          </p>
        </div>
        <Badge variant="secondary">{facts.length} bilgi</Badge>
      </div>

      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {facts.map((fact) => (
          <KnowledgeFactRow
            key={fact.id}
            storeId={storeId}
            fact={fact}
            onUpdated={onUpdated}
          />
        ))}
      </div>
    </section>
  )
}

function KnowledgeFactRow({
  storeId,
  fact,
  onUpdated,
}: {
  storeId: string
  fact: CatalogProductKnowledgeFact
  onUpdated?: () => void | Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(fact.value)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      setError("Bilgi değeri boş bırakılamaz.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updateProductKnowledgeFact(
        storeId,
        fact.id,
        normalizedValue,
        needsConfirmation
      )
      setIsEditing(false)
      setNeedsConfirmation(false)
      await onUpdated?.()
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
          : "Ürün bilgisi güncellenemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function archive() {
    setIsDeleting(true)
    setError(null)
    try {
      await archiveProductKnowledgeFact(storeId, fact.id)
      setDeleteOpen(false)
      await onUpdated?.()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ürün bilgisi kaldırılamadı."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {fact.label}
            </p>
            {fact.variant ? (
              <Badge variant="outline" className="bg-background text-[10px]">
                {variantScopeLabel(fact)}
              </Badge>
            ) : null}
          </div>

          {isEditing ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                autoFocus
                value={value}
                disabled={isSaving}
                onChange={(event) => {
                  setValue(event.target.value)
                  setNeedsConfirmation(false)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void save()
                  }
                  if (event.key === "Escape" && !isSaving) {
                    setValue(fact.value)
                    setIsEditing(false)
                  }
                }}
                className="h-8 flex-1 bg-background"
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={isSaving}
                  aria-label="Düzenlemeyi iptal et"
                  onClick={() => {
                    setValue(fact.value)
                    setError(null)
                    setNeedsConfirmation(false)
                    setIsEditing(false)
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving || !value.trim()}
                  onClick={() => void save()}
                >
                  <HugeiconsIcon
                    icon={isSaving ? Loading03Icon : CheckmarkCircle01Icon}
                    className={isSaving ? "size-3.5 animate-spin" : "size-3.5"}
                  />
                  {isSaving
                    ? "Kaydediliyor"
                    : needsConfirmation
                      ? "Yine de kaydet"
                      : "Kaydet"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-sm leading-6 font-medium text-foreground">
              {fact.value}
            </p>
          )}

          {needsConfirmation ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Ölçü olağan dışı görünüyor. Doğruysa yeniden onaylayın.
            </p>
          ) : error ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {knowledgeDateFormatter.format(new Date(fact.verifiedAt))}
            </p>
          )}
        </div>

        {!isEditing ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Ürün bilgisini düzenle"
              onClick={() => {
                setError(null)
                setIsEditing(true)
              }}
            >
              <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
            </Button>

            <Popover
              open={deleteOpen}
              onOpenChange={(open) => {
                if (!isDeleting) setDeleteOpen(open)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Ürün bilgisini kaldır"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-80">
                <PopoverHeader>
                  <PopoverTitle>
                    Bilgiyi kaldırmak istiyor musunuz?
                  </PopoverTitle>
                  <PopoverDescription className="leading-5">
                    AI bu bilgiyi yeni yanıtlarda kullanmayacak. Bu bilgiyle
                    hazırlanmış bekleyen taslaklar yeniden değerlendirilecek.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDeleting}
                    onClick={() => setDeleteOpen(false)}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => void archive()}
                  >
                    <HugeiconsIcon
                      icon={isDeleting ? Loading03Icon : Delete02Icon}
                      className={
                        isDeleting ? "size-3.5 animate-spin" : "size-3.5"
                      }
                    />
                    {isDeleting ? "Kaldırılıyor" : "Bilgiyi kaldır"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function variantScopeLabel(fact: CatalogProductKnowledgeFact) {
  if (!fact.variant) return "Tüm ürün"
  return [fact.variant.size, fact.variant.color, fact.variant.sku]
    .filter(Boolean)
    .join(" · ")
}

const knowledgeDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
})
