"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Layers01Icon,
  Package01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { updateStore } from "@/lib/api/stores"
import { cn } from "@/lib/utils"
import type { InventoryPolicy } from "@/types/store"

const OPTIONS: Array<{
  value: InventoryPolicy
  title: string
  description: string
  icon: typeof Layers01Icon
}> = [
  {
    value: "SHARED",
    title: "Ortak stok havuzu",
    description: "Aynı stok farklı pazaryerlerinde tekrar sayılmaz.",
    icon: Layers01Icon,
  },
  {
    value: "CHANNEL_SPECIFIC",
    title: "Kanallara özel stok",
    description: "Her pazaryerinin stok miktarı ayrı kabul edilir.",
    icon: Package01Icon,
  },
]

export function StoreInventoryPolicyForm({
  storeId,
  initialValue,
}: {
  storeId: string
  initialValue: InventoryPolicy | null
}) {
  const router = useRouter()
  const [savedValue, setSavedValue] = useState<InventoryPolicy>(
    initialValue ?? "SHARED"
  )
  const [value, setValue] = useState<InventoryPolicy>(savedValue)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (value === savedValue || isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      const store = await updateStore(storeId, { inventoryPolicy: value })
      setSavedValue(store.inventoryPolicy ?? value)
      setValue(store.inventoryPolicy ?? value)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Stok yapısı güncellenemedi."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Stok yapısı</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            Aynı ürün birden fazla pazaryerinde bulunduğunda stokların nasıl
            hesaplanacağını belirler.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={value === savedValue || isSaving}
          onClick={() => void save()}
          className="min-w-24"
        >
          <HugeiconsIcon
            icon={isSaving ? RefreshIcon : CheckmarkCircle01Icon}
            className={cn("size-4", isSaving && "animate-spin")}
          />
          {isSaving ? "Kaydediliyor" : "Kaydet"}
        </Button>
      </div>

      <div
        role="radiogroup"
        aria-label="Stok yapısı"
        className="mt-5 grid gap-3 md:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isSaving}
              onClick={() => {
                setValue(option.value)
                setError(null)
              }}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                selected
                  ? "border-primary/40 bg-primary/[0.07]"
                  : "border-border hover:bg-muted/35"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <HugeiconsIcon icon={option.icon} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {option.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
