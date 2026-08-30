"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { restoreStore } from "@/lib/api/stores"
import type { StoreSummary } from "@/types/store"

type StoreRestoreActionProps = {
  storeId: string
  storeName: string
}

export function StoreRestoreAction({
  storeId,
  storeName,
}: StoreRestoreActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoredStore, setRestoredStore] = useState<StoreSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isRestoring) return

    setOpen(nextOpen)
    if (!nextOpen) {
      setRestoredStore(null)
      setError(null)
    }
  }

  async function handleRestore() {
    setIsRestoring(true)
    setError(null)
    let restoreCompleted = Boolean(restoredStore)

    try {
      if (!restoredStore) {
        const store = await restoreStore(storeId)
        setRestoredStore(store)
        restoreCompleted = true
      }

      await selectActiveStore(storeId)
      setOpen(false)
      setRestoredStore(null)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : restoreCompleted
            ? "Mağaza geri yüklendi ancak görünüm yenilenemedi. Tekrar deneyin."
            : "Mağaza geri yüklenemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      preventClose={isRestoring}
      title="Mağazayı geri yükle"
      description={`${storeName} mağazasını yeniden kullanıma açmak üzeresiniz.`}
      trigger={
        <Button type="button">
          <HugeiconsIcon icon={RefreshIcon} className="size-4" />
          Geri yükle
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={isRestoring}
          >
            Vazgeç
          </Button>
          <Button type="button" onClick={handleRestore} disabled={isRestoring}>
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-4 ${isRestoring ? "animate-spin" : ""}`}
            />
            {isRestoring
              ? "Geri yükleniyor..."
              : restoredStore
                ? "Görünümü yenilemeyi tekrar dene"
                : "Mağazayı geri yükle"}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">
            Mağaza verileri kaldığı yerden kullanılacak.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Kanal bağlantıları, ürünler ve sorular korunur. Geri yükleme
            tamamlandığında tüm mağaza sayfalarına yeniden erişebilirsiniz.
          </p>
        </div>
        <div className="min-h-5 text-sm" aria-live="polite">
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      </div>
    </ResponsiveDialog>
  )
}
