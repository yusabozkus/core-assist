"use client"

import { useState } from "react"
import {
  DatabaseExportIcon,
  Delete02Icon,
  RefreshIcon,
  ShieldAlertIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { clearActiveStore } from "@/app/(dashboard)/dashboard/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { exportCurrentUserData } from "@/lib/api/users"
import { authClient } from "@/lib/auth-client"

const DELETE_CONFIRMATION = "HESABIMI SİL"

type AccountDataControlsProps = {
  ownedWorkspaceCount: number
  ownedStoreCount: number
}

export function AccountDataControls({
  ownedWorkspaceCount,
  ownedStoreCount,
}: AccountDataControlsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isConfirmed = confirmation === DELETE_CONFIRMATION

  async function handleExport() {
    if (isExporting) return

    setIsExporting(true)
    setExportError(null)

    try {
      const data = await exportCurrentUserData()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const downloadURL = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = downloadURL
      anchor.download = `coreassist-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(downloadURL)
    } catch (caughtError) {
      setExportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Veri arşiviniz hazırlanamadı."
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDelete() {
    if (!isConfirmed || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await authClient.deleteUser({
        callbackURL: new URL(
          APP_ROUTES.login,
          window.location.origin
        ).toString(),
      })

      if (result.error || !result.data?.success) {
        throw new Error(
          getDeleteError(result.error?.code, result.error?.message)
        )
      }

      await clearActiveStore().catch(() => undefined)
      window.location.replace(`${APP_ROUTES.login}?reason=account_deleted`)
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "Hesabınız silinemedi. Lütfen tekrar deneyin."
      )
      setIsDeleting(false)
    }
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && isDeleting) return
    setDeleteOpen(open)
    if (!open) {
      setConfirmation("")
      setDeleteError(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <h2 className="font-semibold tracking-[-0.01em]">Veriler ve hesap</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Verilerinizin bir kopyasını indirin veya hesabınızı kalıcı olarak
          kapatın.
        </p>
      </div>

      <div className="divide-y divide-border">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <HugeiconsIcon icon={DatabaseExportIcon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Verilerinizi dışa aktarın</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Profil, mağaza, katalog, soru ve yanıt verileriniz JSON biçiminde
              hazırlanır. Gizli erişim anahtarları dosyaya eklenmez.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start bg-background sm:self-auto"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            <HugeiconsIcon
              icon={isExporting ? RefreshIcon : DatabaseExportIcon}
              className={`size-4 ${isExporting ? "animate-spin" : ""}`}
            />
            {isExporting ? "Hazırlanıyor..." : "Verilerimi indir"}
          </Button>
        </div>

        <div className="flex flex-col gap-4 bg-destructive/[0.025] px-5 py-5 sm:flex-row sm:items-center sm:px-6 dark:bg-destructive/[0.04]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <HugeiconsIcon icon={ShieldAlertIcon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Hesabı kalıcı olarak silin</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Profiliniz ve sahibi olduğunuz tüm çalışma alanları geri alınamaz
              biçimde silinir.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="self-start sm:self-auto"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            Hesabımı sil
          </Button>
        </div>
      </div>

      {exportError ? (
        <p
          className="border-t border-border px-5 py-3 text-sm text-destructive sm:px-6"
          role="alert"
        >
          {exportError}
        </p>
      ) : null}

      <ResponsiveDialog
        open={deleteOpen}
        onOpenChange={handleDeleteOpenChange}
        preventClose={isDeleting}
        title="CoreAssist hesabınızı silin"
        description="Bu işlem hesabınızı ve sahibi olduğunuz işletme verilerini kalıcı olarak siler."
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
              disabled={!isConfirmed || isDeleting}
              onClick={() => void handleDelete()}
            >
              <HugeiconsIcon
                icon={isDeleting ? RefreshIcon : Delete02Icon}
                className={`size-4 ${isDeleting ? "animate-spin" : ""}`}
              />
              {isDeleting ? "Hesap siliniyor..." : "Kalıcı olarak sil"}
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
              {ownedWorkspaceCount.toLocaleString("tr-TR")} çalışma alanı ve bu
              alanlara bağlı {ownedStoreCount.toLocaleString("tr-TR")} mağaza;
              ürünleri, kanal bağlantıları, soruları, AI taslakları ve
              yanıtlarıyla birlikte silinecek. Bağlı Google veya Microsoft
              hesabınızın kendisi silinmez.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="delete-account-confirmation">
              Devam etmek için <strong>{DELETE_CONFIRMATION}</strong> yazın
            </Label>
            <Input
              id="delete-account-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={DELETE_CONFIRMATION}
              autoComplete="off"
              className="bg-background"
              disabled={isDeleting}
            />
          </div>

          {deleteError ? (
            <p className="text-sm leading-5 text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
        </div>
      </ResponsiveDialog>
    </section>
  )
}

function getDeleteError(code?: string, message?: string) {
  const normalizedCode = code?.toLowerCase() ?? ""
  if (
    normalizedCode.includes("session_expired") ||
    message?.toLowerCase().includes("fresh")
  ) {
    return "Güvenliğiniz için çıkış yapıp yeniden giriş yaptıktan sonra hesap silme işlemini tekrar deneyin."
  }
  return message || "Hesabınız silinemedi. Lütfen tekrar deneyin."
}
