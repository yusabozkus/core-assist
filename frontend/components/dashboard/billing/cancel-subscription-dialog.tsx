"use client"

import { useState } from "react"
import { AlertCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { createBillingPortalSession } from "@/lib/api/billing"
import { formatBillingDate } from "@/lib/billing"

export function CancelSubscriptionDialog({
  storeId,
  accessEndsAt,
}: {
  storeId: string
  accessEndsAt: string
}) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openCancellation() {
    setIsOpeningPortal(true)
    setError(null)
    try {
      const session = await createBillingPortalSession(storeId)
      window.location.assign(session.cancelSubscriptionUrl ?? session.overviewUrl)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Abonelik yönetimi şu anda açılamıyor."
      )
      setIsOpeningPortal(false)
    }
  }

  return (
    <ResponsiveDialog
      title="Abonelik yenilemesini durdur"
      description={`İptal sonrasında planınız ${formatBillingDate(accessEndsAt)} tarihine kadar devam eder.`}
      preventClose={isOpeningPortal}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          Aboneliği iptal et
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isOpeningPortal}
            onClick={close}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isOpeningPortal}
            onClick={openCancellation}
          >
            {isOpeningPortal ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-3.5 animate-spin"
              />
            ) : null}
            {isOpeningPortal ? "Paddle açılıyor" : "Yenilemeyi durdur"}
          </Button>
        </>
      )}
    >
      <div className="space-y-5 py-2">
        <div className="flex gap-3">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div>
            <p className="text-sm font-medium">Dönem sonunda otomasyon durur</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI yanıtları ve kanal senkronizasyonu dönem sonunda durdurulur.
              Kayıtlı verileriniz hesabınızda korunur.
            </p>
          </div>
        </div>
        <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          {"İptal işlemini Paddle'ın güvenli abonelik yönetimi ekranında tamamlayacaksınız."}
        </p>
        {error ? (
          <p role="alert" className="text-xs leading-5 text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
