"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Delete02Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  clearActiveStore,
  selectActiveStore,
} from "@/app/(dashboard)/dashboard/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { deleteStore, type DeleteStoreResult } from "@/lib/api/stores"

type StoreDeleteActionProps = {
  storeId: string
  storeName: string
}

const DELETE_CONFIRMATION_TEXT = "Evet, onaylıyorum"

export function StoreDeleteAction({
  storeId,
  storeName,
}: StoreDeleteActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<DeleteStoreResult | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const isConfirmed = confirmation === DELETE_CONFIRMATION_TEXT

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isDeleting) return

    setOpen(nextOpen)
    if (!nextOpen) {
      setConfirmation("")
      setDeleteResult(null)
      setError(null)
    }
  }

  async function handleDelete() {
    if (!deleteResult && !isConfirmed) return

    setIsDeleting(true)
    setError(null)
    let deletionCompleted = Boolean(deleteResult)

    try {
      const result = deleteResult ?? (await deleteStore(storeId, confirmation))

      if (!deleteResult) {
        setDeleteResult(result)
        deletionCompleted = true
      }

      if (result.nextStore) {
        await selectActiveStore(result.nextStore.id)
      } else {
        await clearActiveStore()
      }

      setOpen(false)
      setDeleteResult(null)
      router.replace(
        result.nextStore
          ? APP_ROUTES.dashboard.settings.root
          : APP_ROUTES.onboarding
      )
      router.refresh()
    } catch (caughtError) {
      setError(
        deletionCompleted
          ? "Mağaza silindi ancak yönlendirme tamamlanamadı. Tekrar deneyin."
          : caughtError instanceof Error
            ? caughtError.message
            : "Mağaza silinemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      preventClose={isDeleting}
      title="Mağazayı kalıcı olarak sil"
      description={`${storeName} mağazası ve mağazaya bağlı tüm veriler kalıcı olarak silinecek.`}
      trigger={
        <Button type="button" variant="destructive">
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          Mağazayı sil
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={isDeleting}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || (!deleteResult && !isConfirmed)}
          >
            <HugeiconsIcon
              icon={isDeleting ? RefreshIcon : Delete02Icon}
              className={`size-4 ${isDeleting ? "animate-spin" : ""}`}
            />
            {isDeleting
              ? "Mağaza siliniyor..."
              : deleteResult
                ? "Yönlendirmeyi tekrar dene"
                : "Kalıcı olarak sil"}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">
            Bu işlem geri alınamaz.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Bu mağazaya bağlı kanal bağlantıları, şifrelenmiş bağlantı
            bilgileri, ürünler, varyantlar, stok bilgileri, müşteri soruları,
            taslaklar ve gönderilmiş cevap kayıtları kalıcı olarak silinecek.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="delete-store-confirmation">
            Devam etmek için <strong>{DELETE_CONFIRMATION_TEXT}</strong>{" "}
            ifadesini birebir yazın
          </Label>
          <Input
            id="delete-store-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={DELETE_CONFIRMATION_TEXT}
            autoComplete="off"
            disabled={isDeleting || Boolean(deleteResult)}
            autoFocus
          />
        </div>

        <div className="min-h-5 text-sm" aria-live="polite">
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      </div>
    </ResponsiveDialog>
  )
}
