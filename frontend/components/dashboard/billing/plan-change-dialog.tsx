"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Loading03Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  confirmBillingPlanChange,
  getBillingPlanChange,
  previewBillingPlanChange,
} from "@/lib/api/billing"
import {
  formatBillingAmount,
  formatBillingDate,
  getBillingPlanName,
} from "@/lib/billing"
import { cn } from "@/lib/utils"
import type {
  BillingCycle,
  BillingPlanId,
  BillingPlanChangePreview,
  BillingPlanChangeResult,
} from "@/types/billing"

export function PlanChangeDialog({
  workspaceId,
  plan,
  cycle,
  pendingId,
  open,
  onOpenChange,
}: {
  workspaceId: string
  plan: BillingPlanId
  cycle: BillingCycle
  pendingId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<BillingPlanChangePreview | null>(null)
  const [result, setResult] = useState<BillingPlanChangeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [revision, setRevision] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const submittingRef = useRef(false)
  const changeId = result?.id ?? pendingId
  const pending = Boolean(
    changeId &&
    (!result ||
      [
        "PROCESSING",
        "RETRY_SCHEDULED",
        "AWAITING_WEBHOOK",
        "REVIEW_REQUIRED",
      ].includes(result.status))
  )

  useEffect(() => {
    if (!open || pendingId) return
    const abort = new AbortController()
    void previewBillingPlanChange(workspaceId, plan, cycle, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setPreview(value)
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(message(cause))
      })
    return () => abort.abort()
  }, [workspaceId, plan, cycle, pendingId, open, revision])

  useEffect(() => {
    if (!open || !changeId || !pending) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const next = await getBillingPlanChange(
          workspaceId,
          changeId!,
          abort.signal
        )
        if (abort.signal.aborted) return
        setResult(next)
        if (next.status === "COMPLETED") {
          router.refresh()
          return
        }
        if (next.status === "FAILED") return
        timer = setTimeout(() => void poll(), nextPlanChangePollDelay(next))
      } catch (cause) {
        if (abort.signal.aborted) return
        setError(message(cause))
        timer = setTimeout(() => void poll(), 5000)
      }
    }
    void poll()
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [workspaceId, changeId, open, pending, router])

  async function confirm() {
    if (!preview || !preview.canConfirm || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const next = await confirmBillingPlanChange(workspaceId, preview.id)
      setResult(next)
      if (next.status === "COMPLETED") router.refresh()
    } catch (cause) {
      // The response may have been lost AFTER payment submission. Keep the same
      // operation ID; never silently create and confirm a second quote.
      setError(message(cause))
      try {
        setResult(await getBillingPlanChange(workspaceId, preview.id))
      } catch {
        /* Retry uses the same ID. */
      }
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  function renewPreview() {
    setPreview(null)
    setResult(null)
    setError(null)
    setRevision((value) => value + 1)
  }

  async function refreshStatus() {
    if (!changeId || refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const next = await getBillingPlanChange(workspaceId, changeId)
      setResult(next)
      if (next.status === "COMPLETED") router.refresh()
    } catch (cause) {
      setError(message(cause))
    } finally {
      setRefreshing(false)
    }
  }

  const completed = result?.status === "COMPLETED"
  const failed = result?.status === "FAILED"
  const loading = !preview && !result && !pendingId && !error
  const showPreview = preview && !pending && !completed && !failed
  const amounts = preview?.amounts
  const deferredDowngrade =
    preview?.changeType === "downgrade" &&
    preview.settlementTiming === "next_billing_period"
  const money = (value: string) => formatMinorAmount(value, amounts!.currency)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submitting) {
          onOpenChange(value)
          if (!value) router.refresh()
        }
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl"
        showCloseButton={!submitting}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">
            {completed
              ? "Planınız güncellendi"
              : "Plan değişikliğini inceleyin"}
          </DialogTitle>
          <DialogDescription>
            {getBillingPlanName(
              plan.toUpperCase() as BillingPlanChangePreview["plan"]
            )}{" "}
            · {cycle === "annual" ? "Yıllık ödeme" : "Aylık ödeme"}
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div
            role="status"
            className="flex items-center gap-3 py-10 text-muted-foreground"
          >
            <Loader /> Paddle üzerinden güncel tutar hesaplanıyor…
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/8 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {showPreview && amounts && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-5 border-b border-border pb-5">
              <div>
                <p className="text-sm font-medium">Şimdi ödenecek</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deferredDowngrade
                    ? "Plan hemen değişir, mahsup sonraki faturaya yansır"
                    : "Vergiler ve varsa mahsup dahil"}
                </p>
              </div>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {money(amounts.dueNow)}
              </p>
            </div>
            <dl className="space-y-2.5 text-sm">
              <AmountRow
                label="Kullanılmayan süre alacağı"
                value={money(amounts.credit)}
              />
              <AmountRow
                label="Yeni planın kalan süre ücreti"
                value={money(amounts.charge)}
              />
              <AmountRow
                label={
                  amounts.differenceAction === "credit"
                    ? "Net alacak farkı"
                    : "Net ücret farkı"
                }
                value={money(amounts.difference)}
              />
              <AmountRow
                label={`Sonraki ödeme · ${formatBillingDate(amounts.nextBilledAt)}`}
                value={money(amounts.nextTotal)}
              />
              <AmountRow
                label="Sonraki dönemlerin plan tutarı"
                value={`${money(amounts.recurringTotal)} / ${cycle === "annual" ? "yıl" : "ay"}`}
              />
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">
              {deferredDowngrade ? (
                <>
                  Yeni plan ve limitler onaydan sonra hemen uygulanır. Kalan
                  süreden doğan alacak {formatBillingDate(amounts.nextBilledAt)}{" "}
                  tarihli Paddle faturasına mahsup edilir; kartınıza anlık nakit
                  iade yapılmaz.
                </>
              ) : (
                <>
                  Değişiklik onaydan sonra hemen uygulanır. Ücret farkı kayıtlı
                  ödeme yönteminden tahsil edilir; ödeme başarısızsa plan
                  değişmez.
                  {amounts.differenceAction === "credit" &&
                    " Alacak, Paddle tarafından mahsup edilir; kartınıza nakit iade taahhüdü değildir."}
                </>
              )}{" "}
              Fiyat farkı kullanılan soru miktarına göre değil, dönemde kalan
              süreye göre hesaplanır. Tutarlar onay sırasında yeniden
              doğrulanır.
            </p>
            <div className="border-t border-border pt-5">
              <h3 className="font-medium">Yeni planla kapasiteniz</h3>
              <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                <span>Kaynak</span>
                <span>Mevcut kullanım / yeni limit</span>
              </div>
              <dl className="mt-2 divide-y divide-border">
                {preview.capacity.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex justify-between gap-4 py-2.5 text-sm",
                      item.used > item.limit && "text-destructive"
                    )}
                  >
                    <dt>{item.label}</dt>
                    <dd className="font-medium tabular-nums">
                      {item.used.toLocaleString("tr-TR")} /{" "}
                      {item.limit.toLocaleString("tr-TR")}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt>Aylık AI sorusu</dt>
                  <dd className="font-medium tabular-nums">
                    {preview.questions.used.toLocaleString("tr-TR")} /{" "}
                    {preview.questions.limit.toLocaleString("tr-TR")}
                  </dd>
                </div>
              </dl>
              {!preview.canConfirm && (
                <p className="mt-3 text-sm leading-6 text-destructive">
                  Bu plana geçmeden önce kırmızı gösterilen kaynakların
                  kullanımını azaltın. Mağazalarınız veya ürünleriniz otomatik
                  silinmez.
                </p>
              )}
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Kullanılmış soru hakları sıfırlanmaz. Sonraki kota yenilemesi:{" "}
                {formatBillingDate(preview.questions.resetsAt)}.
                {preview.questions.used >= preview.questions.limit &&
                  " Yeni planda soru hakkınız kalmayacağı için yeni ücretli AI işlemleri kota yenilenene kadar durur; manuel yanıtlamaya devam edebilirsiniz."}
              </p>
            </div>
          </div>
        )}
        {pending && (
          <div role="status" className="space-y-3 py-4">
            <div className="flex items-center gap-3 font-medium">
              <Loader />{" "}
              {result?.status === "RETRY_SCHEDULED"
                ? "Paddle yoğunluğu nedeniyle yeniden denenecek"
                : result?.status === "REVIEW_REQUIRED"
                  ? "İşlem sonucu doğrulanıyor"
                  : "Plan değişikliği işleniyor"}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {result?.status === "RETRY_SCHEDULED"
                ? `${formatRetryAt(result.retryAt) ?? "Belirlenen zamandan"} sonra otomatik olarak yeniden denenecek. Yeni bir işlem başlatmanıza gerek yok.`
                : "Paddle doğrulaması geldiğinde planınız ve limitleriniz güncellenecek. Bu pencereyi kapatabilirsiniz; tekrar ödeme başlatılmayacak."}
            </p>
            {result?.status === "REVIEW_REQUIRED" && (
              <p className="text-sm text-muted-foreground">
                Sonuç henüz kesinleşmedi. Durum değişmezse destek ile iletişime
                geçin. İşlem referansı:{" "}
                <span className="font-mono text-xs break-all">{changeId}</span>
              </p>
            )}
          </div>
        )}
        {completed && (
          <div role="status" className="flex gap-3 py-4">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="size-6 shrink-0 text-primary"
            />
            <p className="text-sm leading-6">
              Paddle değişikliği doğruladı. Yeni planınız ve limitleriniz
              kullanıma hazır.
            </p>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {result.failureCode === "PRECHECK_FAILED"
              ? "Ön kontrol tamamlanamadı. Değişiklik gönderilmedi; güncel önizlemeyi tekrar alın."
              : "Plan değişikliği uygulanmadı. Abonelik ve ödeme yöntemini kontrol edip yeni bir önizleme alın."}
          </p>
        )}
        <DialogFooter className="border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              if (result) router.refresh()
            }}
            disabled={submitting}
          >
            {completed ? "Tamam" : "Kapat"}
          </Button>
          {pending ? (
            <Button
              variant="outline"
              onClick={() => void refreshStatus()}
              disabled={refreshing}
            >
              {refreshing && <Loader />} Durumu yenile
            </Button>
          ) : completed ? null : (error ||
              failed ||
              (preview && !preview.canConfirm)) &&
            !pendingId ? (
            <Button onClick={renewPreview} disabled={submitting}>
              Önizlemeyi yenile
            </Button>
          ) : showPreview ? (
            <Button
              onClick={() => void confirm()}
              disabled={submitting || !preview.canConfirm}
            >
              {submitting && <Loader />}{" "}
              {submitting ? "İşleniyor…" : "Onayla ve planı değiştir"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Loader() {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      className="size-4 shrink-0 animate-spin"
    />
  )
}
function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}
function message(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin."
}
function nextPlanChangePollDelay(result: BillingPlanChangeResult) {
  if (result.status !== "RETRY_SCHEDULED" || !result.retryAt) return 2000
  return Math.min(
    60_000,
    Math.max(2000, Date.parse(result.retryAt) - Date.now() + 1000)
  )
}
function formatRetryAt(value?: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}
function formatMinorAmount(value: string, currency: string) {
  const digits = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits
  return formatBillingAmount(Number(value) / 10 ** (digits ?? 2), currency)
}
