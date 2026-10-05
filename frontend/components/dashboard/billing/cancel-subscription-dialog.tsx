"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  getSubscriptionManagement,
  manageBillingSubscription,
  refreshBillingSubscription,
} from "@/lib/api/billing"
import { ApiError } from "@/lib/api/client"
import { formatBillingDate } from "@/lib/billing"
import { billingRoutes } from "@/lib/billing-routes"
import type {
  BillingSubscriptionAction,
  BillingSubscriptionManagement,
} from "@/types/billing"

type Phase =
  | "loading"
  | "ready"
  | "submitting"
  | "checking"
  | "pending"
  | "complete"
  | "error"

export function CancelSubscriptionDialog({
  workspaceId,
  cancellationScheduled,
  status,
}: {
  workspaceId: string
  cancellationScheduled: boolean
  status: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("loading")
  const [snapshot, setSnapshot] =
    useState<BillingSubscriptionManagement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completedAction, setCompletedAction] =
    useState<BillingSubscriptionAction | null>(null)
  const request = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  const pending = useRef<{
    action: BillingSubscriptionAction
    subscriptionId: string
  } | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [])

  const isBusy = ["loading", "submitting", "checking"].includes(phase)
  const reverse = snapshot
    ? snapshot.cancellationScheduled
    : cancellationScheduled
  const endsAt = snapshot?.accessEndsAt

  function notifyUpdated() {
    if (!mounted.current) return
    window.dispatchEvent(new Event("billing-updated"))
    router.refresh()
  }

  async function synchronize(action: BillingSubscriptionAction) {
    try {
      const result = await refreshBillingSubscription(
        workspaceId,
        AbortSignal.timeout(20_000)
      )
      if (!mounted.current) return
      const confirmed =
        action === "cancel"
          ? result.subscription.cancelAtPeriodEnd ||
            result.subscription.status === "CANCELED"
          : !result.subscription.cancelAtPeriodEnd &&
            ["ACTIVE", "TRIALING", "PAST_DUE"].includes(
              result.subscription.status
            )
      if (!confirmed)
        throw new Error("Yerel abonelik durumu henüz güncellenmedi.")
      pending.current = null
      setCompletedAction(action)
      setPhase("complete")
      setError(null)
      notifyUpdated()
    } catch {
      if (!mounted.current) return
      setPhase("pending")
      setError(
        "İşlem alındı. Hesabınızdaki güncelleme henüz doğrulanamadı; durumu tekrar kontrol edebilirsiniz."
      )
    }
  }

  async function load() {
    if (busy.current) return
    busy.current = true
    setError(null)
    setPhase(pending.current ? "checking" : "loading")
    request.current = new AbortController()
    const controller = request.current
    const timer = setTimeout(() => controller.abort(), 45_000)
    try {
      const current = await getSubscriptionManagement(
        workspaceId,
        controller.signal
      )
      if (!mounted.current) return
      setSnapshot(current)
      if (pending.current) {
        const intent = pending.current
        const applied =
          intent.subscriptionId === current.subscriptionId &&
          (intent.action === "cancel"
            ? current.cancellationScheduled || current.status === "canceled"
            : ["active", "trialing", "past_due"].includes(current.status) &&
              current.scheduledChangeAction === null)
        if (applied) {
          await synchronize(intent.action)
        } else if (current.status === "canceled") {
          // A completed cancellation cannot be undone. Synchronize it before
          // offering a new purchase instead of checking an impossible undo.
          const result = await refreshBillingSubscription(
            workspaceId,
            controller.signal
          )
          if (!mounted.current) return
          if (result.subscription.status !== "CANCELED")
            throw new Error("Abonelik durumu henüz güncellenmedi.")
          pending.current = null
          setPhase("ready")
          notifyUpdated()
        } else {
          setPhase("pending")
          setError(
            "İşlem sonucu henüz doğrulanamadı. Yeni bir işlem başlatmadan durumu tekrar kontrol edin."
          )
        }
      } else {
        if (current.status === "canceled") {
          const result = await refreshBillingSubscription(
            workspaceId,
            controller.signal
          )
          if (!mounted.current) return
          if (result.subscription.status !== "CANCELED") {
            throw new Error(
              "Abonelik durumu henüz güncellenmedi. Yeni plan seçmeden önce durumu tekrar kontrol edin."
            )
          }
          notifyUpdated()
        }
        setPhase("ready")
      }
    } catch (caught) {
      if (!mounted.current) return
      setError(
        caught instanceof Error && caught.name === "AbortError"
          ? "Abonelik kontrolü zaman aşımına uğradı. Lütfen tekrar deneyin."
          : caught instanceof Error
            ? caught.message
            : "Abonelik durumu alınamadı."
      )
      setPhase(pending.current ? "pending" : "error")
    } finally {
      clearTimeout(timer)
      busy.current = false
    }
  }

  async function submit() {
    if (busy.current || phase !== "ready" || !snapshot?.action) return
    busy.current = true
    const action = snapshot.action
    setPhase("submitting")
    setError(null)
    pending.current = { action, subscriptionId: snapshot.subscriptionId }
    request.current = new AbortController()
    const controller = request.current
    const timer = setTimeout(() => controller.abort(), 50_000)
    try {
      const result = await manageBillingSubscription(
        workspaceId,
        {
          action,
          subscriptionId: snapshot.subscriptionId,
          updatedAt: snapshot.updatedAt,
        },
        controller.signal
      )
      if (!mounted.current) return
      setSnapshot(result.subscription)
      if (!result.completed)
        throw new Error("İşlem sonucu henüz doğrulanamadı.")
      if (result.synchronized) {
        pending.current = null
        setCompletedAction(action)
        setPhase("complete")
        notifyUpdated()
      } else {
        setPhase("pending")
        setError(
          "Değişiklik kaydedildi. Hesabınızdaki güncelleme henüz tamamlanmadı; durumu kontrol edebilirsiniz."
        )
      }
    } catch (caught) {
      if (!mounted.current) return
      // A rejected precheck did not perform a write. A lost/5xx response may
      // already have changed Paddle; only read its result until confirmed.
      if (
        caught instanceof ApiError &&
        caught.status >= 400 &&
        caught.status < 500
      ) {
        pending.current = null
        setPhase("error")
      } else {
        setPhase("pending")
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : "İşlem sonucu doğrulanamadı. Abonelik durumunu kontrol edin."
      )
    } finally {
      clearTimeout(timer)
      busy.current = false
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy.current) return
    setOpen(next)
    if (next) {
      setSnapshot(null)
      setCompletedAction(null)
      void load()
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      dismissOnOutsideInteraction={false}
      dismissOnEscape={false}
      preventClose={isBusy}
      title={
        phase === "complete"
          ? "Abonelik güncellendi"
          : snapshot?.status === "canceled" || snapshot?.status === "paused"
            ? "Abonelik durumu"
            : reverse
              ? "Planlanan iptali geri al"
              : "Abonelik yenilemesini durdur"
      }
      description={
        phase === "complete"
          ? completedAction === "cancel"
            ? snapshot?.status === "canceled"
              ? "Aboneliğiniz sona erdi. Dilediğiniz zaman yeni bir plan seçebilirsiniz."
              : "Yenileme durduruldu. Mevcut döneminizin sonuna kadar hizmeti kullanabilirsiniz."
            : "Planlanan iptal kaldırıldı. Aboneliğiniz mevcut planıyla yenilenmeye devam edecek."
          : "Aboneliğinizi bu ekran üzerinden yönetebilirsiniz."
      }
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          {cancellationScheduled
            ? "İptali geri al"
            : ["CANCELED", "PAUSED"].includes(status)
              ? "Aboneliği yönet"
              : "Aboneliği iptal et"}
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={close}
          >
            {phase === "complete"
              ? "Tamam"
              : phase === "pending"
                ? "Kapat"
                : "Vazgeç"}
          </Button>
          {phase === "ready" && snapshot?.action && (
            <Button
              type="button"
              size="sm"
              variant={reverse ? "default" : "destructive"}
              onClick={() => void submit()}
            >
              {reverse ? "İptali geri al" : "Yenilemeyi durdur"}
            </Button>
          )}
          {["error", "pending"].includes(phase) && (
            <Button type="button" size="sm" onClick={() => void load()}>
              Durumu kontrol et
            </Button>
          )}
          {phase === "ready" && snapshot?.status === "canceled" && (
            <Button asChild size="sm">
              <Link href={billingRoutes(workspaceId).plans}>Yeni plan seç</Link>
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-4 py-2" aria-live="polite">
        {isBusy ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            {phase === "submitting"
              ? "Değişiklik uygulanıyor…"
              : "Abonelik durumu kontrol ediliyor…"}
          </div>
        ) : null}
        {phase === "ready" && snapshot?.blockedReason ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {snapshot.blockedReason}
          </p>
        ) : null}
        {phase === "ready" && snapshot?.action ? (
          <>
            {endsAt && (
              <dl className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">
                  {reverse
                    ? "Yeniden açılacak yenileme"
                    : "Erişiminizin son günü"}
                </dt>
                <dd className="text-right font-medium">
                  {formatBillingDate(endsAt)}
                </dd>
              </dl>
            )}
            {reverse ? (
              <p className="text-sm leading-6 text-muted-foreground">
                İptali geri aldığınızda şimdi ödeme alınmaz. Mevcut planınız,
                dönem sonunda kayıtlı ödeme yönteminizle yenilenir.
              </p>
            ) : (
              <div className="flex gap-3">
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div>
                  <p className="text-sm font-medium">Dönem sonunda ne olur?</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Yeni AI taslakları, otomatik yanıtlar ve senkronizasyonlar
                    durur. Kayıtlı verilerinizi görüntüleyebilir, mevcut
                    soruları manuel yanıtlayabilir ve faturalarınıza
                    erişebilirsiniz. O tarihe kadar iptali geri alabilirsiniz.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}
        {error && (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  )
}
