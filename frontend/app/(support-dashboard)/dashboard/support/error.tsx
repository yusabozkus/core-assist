"use client"

import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

export default function SupportError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <HugeiconsIcon icon={RefreshIcon} className="size-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">
        Destek bilgileri alınamadı
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Talebiniz kaybolmadı. Bağlantıyı kontrol edip işlemi yeniden
        deneyebilirsiniz.
      </p>
      <Button type="button" className="mt-6" onClick={reset}>
        <HugeiconsIcon icon={RefreshIcon} className="size-4" />
        Tekrar dene
      </Button>
    </div>
  )
}
