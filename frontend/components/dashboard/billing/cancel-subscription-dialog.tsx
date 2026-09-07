import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { BILLING_PREVIEW } from "@/constants/billing"

export function CancelSubscriptionDialog() {
  return (
    <ResponsiveDialog
      title="Abonelik yenilemesini durdur"
      description={`İptal sonrasında planınız ${BILLING_PREVIEW.renewsAt} tarihine kadar devam eder.`}
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
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled>
            Yenilemeyi durdur
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
              AI yanıtları ve kanal senkronizasyonu durdurulur. Kayıtlı
              verileriniz hesabınızda korunur.
            </p>
          </div>
        </div>
        <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Bu ekran örnek abonelik verilerini gösterir. Abonelik işlemleri ödeme
          sistemi kullanıma açıldığında yapılabilecek.
        </p>
      </div>
    </ResponsiveDialog>
  )
}
