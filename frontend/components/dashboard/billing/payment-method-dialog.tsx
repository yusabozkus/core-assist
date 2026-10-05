"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Loading03Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createPaymentMethodCheckout,
  getPaymentMethodCheckoutStatus,
  refreshBillingSubscription,
} from "@/lib/api/billing"
import { formatCurrency } from "@/lib/format-currency"
import { getPaddle, subscribeToPaddleEvents } from "@/lib/paddle"
import type {
  BillingPaymentMethod,
  BillingPaymentMethodCheckout,
} from "@/types/billing"

type Phase =
  "loading" | "ready" | "error" | "verifying" | "pending" | "complete"

export function PaymentMethodDialog({
  workspaceId,
  open,
  onOpenChange,
  onUpdated,
}: {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: (method: BillingPaymentMethod | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className="max-h-[90dvh] max-w-[calc(100%-1rem)] overflow-y-auto rounded-2xl p-4 max-[340px]:p-2 sm:max-w-xl sm:p-6"
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Ödeme yöntemini güncelle</DialogTitle>
          <DialogDescription>
            Kart bilgilerinizi aşağıdaki güvenli formdan güncelleyin.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PaymentMethodCheckout
            workspaceId={workspaceId}
            onClose={() => onOpenChange(false)}
            onUpdated={onUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentMethodCheckout({
  workspaceId,
  onClose,
  onUpdated,
}: {
  workspaceId: string
  onClose: () => void
  onUpdated?: (method: BillingPaymentMethod | null) => void
}) {
  const router = useRouter()
  const id = useId()
  const frameTarget = `paddle-payment-method-${id.replace(/[^a-zA-Z0-9]/g, "")}`
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>("loading")
  const [checkout, setCheckout] = useState<BillingPaymentMethodCheckout | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const verifyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let alive = true
    let opened = false
    let completionStarted = false
    let verifying = false
    let transaction: BillingPaymentMethodCheckout | null = null
    let paddle: Awaited<ReturnType<typeof getPaddle>> | null = null
    let verification: AbortController | null = null
    const controller = new AbortController()
    const loadingTimeout = window.setTimeout(() => {
      controller.abort()
      if (!alive) return
      if (opened) paddle?.Checkout.close()
      opened = false
      setError(
        "Ödeme formu zamanında yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin."
      )
      setPhase("error")
    }, 25_000)

    async function verify() {
      if (!transaction || !alive || verifying) return
      verifying = true
      verification?.abort()
      verification = new AbortController()
      const signal = AbortSignal.any([
        controller.signal,
        verification.signal,
        AbortSignal.timeout(20_000),
      ])
      setPhase("verifying")
      setError(null)
      try {
        let confirmed = await getPaymentMethodCheckoutStatus(
          workspaceId,
          transaction.transactionId,
          signal
        )
        while (!confirmed.completed) {
          await waitForNextCheck(signal)
          confirmed = await getPaymentMethodCheckoutStatus(
            workspaceId,
            transaction.transactionId,
            signal
          )
        }
        if (!alive || signal.aborted) return
        onUpdated?.(confirmed.paymentMethod)
        if (transaction.requiresPayment) {
          // An iframe event cannot grant access: reconcile the subscription
          // from Paddle's authoritative server-side snapshot.
          await refreshBillingSubscription(workspaceId, signal).catch(() => {
            if (alive)
              setError(
                "Ödeme yöntemi güncellendi. Abonelik durumunuz arka planda kontrol ediliyor."
              )
          })
        }
        if (!alive) return
        setPhase("complete")
        window.dispatchEvent(new Event("billing-updated"))
        router.refresh()
      } catch {
        if (!alive || controller.signal.aborted) return
        setError(
          "İşlem sonucu henüz doğrulanamadı. Yeniden ödeme yapmadan durumu kontrol edin."
        )
        setPhase("pending")
      } finally {
        verifying = false
      }
    }
    verifyRef.current = () => void verify()

    const unsubscribe = subscribeToPaddleEvents((event) => {
      if (!alive || !opened || !transaction || controller.signal.aborted) return
      // Error events have no transaction payload. All transaction events must
      // match this exact checkout; other Paddle consumers cannot complete it.
      if (event.data && event.data.transaction_id !== transaction.transactionId)
        return
      if (
        !event.data &&
        ![
          "checkout.error",
          "checkout.payment.error",
          "checkout.failed",
        ].includes(event.name ?? "")
      )
        return
      if (completionStarted) return

      if (
        event.name === "checkout.loaded" ||
        event.name === "checkout.updated"
      ) {
        window.clearTimeout(loadingTimeout)
        setPhase("ready")
        if (event.data) {
          const data = event.data
          if (
            [data.totals.subtotal, data.totals.tax, data.totals.total].every(
              (value) => Number.isFinite(value) && value >= 0
            )
          ) {
            setCheckout((current) =>
              current
                ? {
                    ...current,
                    currency: data.currency_code,
                    subtotal: data.totals.subtotal,
                    tax: data.totals.tax,
                    total: data.totals.total,
                    amountDue:
                      typeof data.totals.balance === "number" &&
                      Number.isFinite(data.totals.balance) &&
                      data.totals.balance >= 0
                        ? data.totals.balance
                        : current.amountDue,
                  }
                : current
            )
          }
        }
      }
      if (event.name === "checkout.completed") {
        completionStarted = true
        window.clearTimeout(loadingTimeout)
        void verify()
      }
      if (
        event.name === "checkout.payment.error" ||
        event.name === "checkout.payment.failed"
      ) {
        setError(
          "Ödeme yöntemi doğrulanamadı. Bilgilerinizi kontrol edip formdan tekrar deneyin."
        )
      }
      if (event.name === "checkout.payment.initiated") setError(null)
      if (event.name === "checkout.error" || event.name === "checkout.failed") {
        window.clearTimeout(loadingTimeout)
        setError("Ödeme formu açılamadı. Lütfen tekrar deneyin.")
        setPhase("error")
      }
      if (event.name === "checkout.closed") {
        window.clearTimeout(loadingTimeout)
        setError(
          "Ödeme formu kapatıldı. Güncellemeye devam etmek için tekrar açabilirsiniz."
        )
        setPhase("error")
      }
    })

    void (async () => {
      try {
        // Load the SDK before preparing a zero-value transaction, so an SDK
        // failure does not leave an unnecessary checkout behind.
        paddle = await getPaddle()
        if (!alive || controller.signal.aborted) return
        transaction = await createPaymentMethodCheckout(
          workspaceId,
          controller.signal
        )
        if (!alive || controller.signal.aborted) return
        setCheckout(transaction)
        opened = true
        paddle.Checkout.open({
          transactionId: transaction.transactionId,
          settings: {
            displayMode: "inline",
            variant: "one-page",
            frameTarget,
            frameInitialHeight: 450,
            frameStyle:
              "width: 100%; min-width: 286px; background-color: transparent; border: none;",
            locale: "tr",
            theme: document.documentElement.classList.contains("dark")
              ? "dark"
              : "light",
            allowLogout: false,
            allowDiscountRemoval: false,
          },
        })
      } catch (cause) {
        if (!alive || controller.signal.aborted) return
        window.clearTimeout(loadingTimeout)
        setError(
          cause instanceof Error ? cause.message : "Ödeme formu açılamadı."
        )
        setPhase("error")
      }
    })()

    return () => {
      alive = false
      controller.abort()
      verification?.abort()
      window.clearTimeout(loadingTimeout)
      unsubscribe()
      verifyRef.current = null
      if (opened) paddle?.Checkout.close()
    }
  }, [workspaceId, frameTarget, attempt, onUpdated, router])

  const showForm = phase === "ready" || phase === "loading"
  const money = (amount: number) => formatCurrency(amount, checkout!.currency)

  return (
    <div className="min-w-0 space-y-4">
      {checkout && showForm && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {checkout.requiresPayment
              ? "Gecikmiş ödemenizi tamamlayın"
              : "Kart güncellemesi ücretsizdir"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {checkout.requiresPayment
              ? "Formu onayladığınızda gecikmiş tutar tahsil edilir ve yeni ödeme yönteminiz kaydedilir."
              : "Bu işlemde ücret alınmaz. Yeni yönteminiz gelecekteki abonelik ödemelerinde kullanılır."}
          </p>
          {checkout.requiresPayment && (
            <>
              <ul className="mt-3 space-y-1 text-xs">
                {checkout.items.map((item, index) => (
                  <li key={index}>
                    {item.name}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Ara toplam</dt>
                  <dd className="tabular-nums">{money(checkout.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Vergi</dt>
                  <dd className="tabular-nums">{money(checkout.tax)}</dd>
                </div>
                <div className="flex justify-between gap-3 font-medium">
                  <dt>Toplam</dt>
                  <dd className="tabular-nums">{money(checkout.total)}</dd>
                </div>
                {checkout.amountDue !== checkout.total && (
                  <div className="flex justify-between gap-3 font-medium">
                    <dt>Kalan ödeme</dt>
                    <dd className="tabular-nums">
                      {money(checkout.amountDue)}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      )}

      {phase === "loading" && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <HugeiconsIcon
            icon={Loading03Icon}
            aria-hidden="true"
            className="size-4 animate-spin"
          />
          Güvenli form hazırlanıyor…
        </div>
      )}

      <div className={showForm ? "min-w-0" : "hidden"}>
        {/* Keep Paddle's complete frame and legal footer visible. */}
        <div className={frameTarget} />
      </div>

      {(phase === "verifying" ||
        phase === "pending" ||
        phase === "complete") && (
        <div
          role="status"
          className="flex flex-col items-center py-8 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={
                phase === "complete" ? CheckmarkCircle01Icon : Loading03Icon
              }
              aria-hidden="true"
              className={
                phase === "verifying" ? "size-6 animate-spin" : "size-6"
              }
            />
          </span>
          <p className="mt-4 text-base font-semibold">
            {phase === "complete"
              ? "Ödeme yönteminiz güncellendi"
              : phase === "pending"
                ? "Doğrulama bekleniyor"
                : "Güncelleme doğrulanıyor"}
          </p>
          <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
            {phase === "complete"
              ? "Yeni ödeme bilgileriniz Paddle tarafından kaydedildi."
              : "İşlem sonucu Paddle üzerinden kontrol ediliyor."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <HugeiconsIcon
            icon={ShieldCheckIcon}
            aria-hidden="true"
            className="size-3.5"
          />
          Kart bilgileriniz Paddle tarafından korunur.
        </p>
        <div className="flex gap-2">
          {phase === "error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPhase("loading")
                setError(null)
                setCheckout(null)
                setAttempt((current) => current + 1)
              }}
            >
              Tekrar dene
            </Button>
          )}
          {phase === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => verifyRef.current?.()}
            >
              Durumu kontrol et
            </Button>
          )}
          <Button
            size="sm"
            variant={phase === "complete" ? "default" : "ghost"}
            onClick={onClose}
          >
            {phase === "complete" ? "Tamam" : "Kapat"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function waitForNextCheck(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const abort = () => {
      window.clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      reject(signal.reason)
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, 1_000)
    signal.addEventListener("abort", abort, { once: true })
  })
}
