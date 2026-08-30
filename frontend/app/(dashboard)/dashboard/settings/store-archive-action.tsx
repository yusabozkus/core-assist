"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Archive02Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { selectActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { archiveStore, type ArchiveStoreResult } from "@/lib/api/stores"

type StoreArchiveActionProps = {
  storeId: string
  storeName: string
}

export function StoreArchiveAction({
  storeId,
  storeName,
}: StoreArchiveActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [archiveResult, setArchiveResult] = useState<ArchiveStoreResult | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isArchiving) return

    setOpen(nextOpen)

    if (!nextOpen) {
      setArchiveResult(null)
      setError(null)
    }
  }

  async function handleArchive() {
    setIsArchiving(true)
    setError(null)
    let archiveCompleted = Boolean(archiveResult)

    try {
      const result = archiveResult ?? (await archiveStore(storeId))

      if (!archiveResult) {
        setArchiveResult(result)
        archiveCompleted = true
      }

      await selectActiveStore(storeId)
      setOpen(false)
      setArchiveResult(null)
      router.replace(APP_ROUTES.dashboard.settings.root)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : archiveCompleted
            ? "Mağaza arşivlendi ancak görünüm yenilenemedi. Tekrar deneyin."
            : "Mağaza arşivlenemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      preventClose={isArchiving}
      title="Mağazayı arşivle"
      description={`${storeName} mağazasını geçici olarak kullanımdan kaldırmak üzeresiniz.`}
      trigger={
        <Button type="button" variant="outline">
          <HugeiconsIcon icon={Archive02Icon} className="size-4" />
          Arşivle
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={isArchiving}
          >
            Vazgeç
          </Button>
          <Button type="button" onClick={handleArchive} disabled={isArchiving}>
            <HugeiconsIcon
              icon={isArchiving ? RefreshIcon : Archive02Icon}
              className={`size-4 ${isArchiving ? "animate-spin" : ""}`}
            />
            {isArchiving
              ? "Arşivleniyor..."
              : archiveResult
                ? "Görünümü yenilemeyi tekrar dene"
                : "Mağazayı arşivle"}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-foreground">
            Mağaza verileri silinmeyecek.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ürün ve soru kayıtları korunur. Mağaza aktif listeden kaldırılır ve
            ürün ile soru senkronizasyonları durdurulur.
          </p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          İşlem tamamlandığında bu mağaza seçili kalır ve yalnızca ayarlar
          sayfasına erişilebilir. Dilediğiniz zaman geri yükleyebilirsiniz.
        </p>
        <div className="min-h-5 text-sm" aria-live="polite">
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      </div>
    </ResponsiveDialog>
  )
}
