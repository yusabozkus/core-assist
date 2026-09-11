"use client"

import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { closeAccountBilling, getAccountDeletionStatus } from "@/lib/api/users"
import type { AccountDeletionStatus } from "@/types/user"

const CLOSURE_CONFIRMATION = "TAHSİLATI DURDUR"
const statusLabels: Record<string, string> = {
  active: "Aktif abonelik",
  trialing: "Paddle deneme aboneliği",
  paused: "Duraklatılmış abonelik",
  past_due: "Ödeme gecikmiş",
  canceled: "İptal tamamlandı",
}

export function AccountBillingClosure({
  onStatusChange,
  onBusyChange,
  disabled,
}: {
  onStatusChange: (status: AccountDeletionStatus | null) => void
  onBusyChange: (busy: boolean) => void
  disabled: boolean
}) {
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState("")

  useEffect(() => {
    let active = true
    getAccountDeletionStatus()
      .then((value) => {
        if (!active) return
        setStatus(value)
        onStatusChange(value)
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Ödeme durumu doğrulanamadı."
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [onStatusChange])

  async function refresh(closeBilling = false) {
    if (loading || closing || disabled) return
    setLoading(true)
    setClosing(closeBilling)
    onBusyChange(true)
    onStatusChange(null)
    setError(null)
    try {
      const value = closeBilling
        ? await closeAccountBilling(confirmation)
        : await getAccountDeletionStatus()
      setStatus(value)
      onStatusChange(value)
      setConfirmation("")
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "İşlem doğrulanamadı. Hesabınız silinmedi."
      )
    } finally {
      setLoading(false)
      setClosing(false)
      onBusyChange(false)
    }
  }

  return (
    <div className="space-y-4 border-y border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Abonelik ve ödeme kontrolü</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Tahsilat devam ederken hesabınız silinmez.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || disabled}
          onClick={() => void refresh()}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            className={`size-4 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Kontrol ediliyor" : "Yenile"}
        </Button>
      </div>
      {status?.workspaces.map((workspace) => (
        <div key={workspace.id} className="space-y-2 text-sm">
          {workspace.subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-col gap-1 text-xs text-muted-foreground"
            >
              <span>
                {statusLabels[subscription.status] ?? "İnceleme gerekli"}
                {subscription.cancelScheduled
                  ? " · Dönem sonu iptali planlandı"
                  : ""}
              </span>
              {subscription.accessEndsAt ? (
                <span>
                  {subscription.status === "canceled"
                    ? "Erişim sona erdi: "
                    : subscription.cancelScheduled
                      ? "Erişim bitişi: "
                      : "Mevcut dönem sonu: "}
                  {new Date(subscription.accessEndsAt).toLocaleString("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : null}
            </div>
          ))}
          {workspace.pendingPaymentCount > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {workspace.pendingPaymentCount} bekleyen ödeme işlemi
            </p>
          ) : null}
          {workspace.issues.map((issue) => (
            <p key={issue} className="text-xs leading-5 text-destructive">
              {issue}
            </p>
          ))}
        </div>
      ))}
      {!loading && !error && status?.canDelete ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          Devam eden abonelik veya bekleyen tahsilat bulunmuyor. Hesabınızı
          silebilirsiniz.
        </p>
      ) : null}
      {status?.canResolveBilling ? (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            Aşağıdaki işlem aboneliklerinizi{" "}
            <strong className="text-foreground">
              hemen iptal eder ve erişiminizi bitirir
            </strong>
            ; iptal edilebilir açık ödemeleri kapatır. Otomatik ücret iadesi
            yapmaz, ödenmemiş faturaları silmez. Dönem sonuna kadar kullanmak
            istiyorsanız hesabınızı o tarihten sonra silin.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="close-account-billing">
              İptali onaylamak için {CLOSURE_CONFIRMATION} yazın
            </Label>
            <Input
              id="close-account-billing"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={CLOSURE_CONFIRMATION}
              disabled={loading || disabled}
              autoComplete="off"
              className="bg-background"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            disabled={
              loading || disabled || confirmation !== CLOSURE_CONFIRMATION
            }
            onClick={() => void refresh(true)}
          >
            {closing
              ? "İptaller doğrulanıyor..."
              : "Abonelikleri ve açık ödemeleri kapat"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Bu adım hesabınızı silmez. Bir hata olursa bazı iptaller tamamlanmış
            olabilir; yeniden denemeden önce durumu yenileyin.
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm leading-5 text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        Silme sonrasında sınırlı ödeme ve iptal referansları ayrı tutulur.
        Paddle üzerindeki fatura kayıtları silinmez. Profiliniz, katalog ve
        mesaj içerikleriniz bu finansal kayda dahil edilmez.
      </p>
    </div>
  )
}
