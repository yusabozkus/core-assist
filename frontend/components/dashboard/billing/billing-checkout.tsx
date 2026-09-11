"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Button } from "@/components/ui/button"
import { INCLUDED_MARKETPLACES } from "@/constants/billing"
import { billingRoutes } from "@/lib/billing-routes"
import { APP_ROUTES } from "@/constants/site"
import {
  cancelPendingBillingCheckout,
  createBillingCheckout,
  getBillingSummary,
} from "@/lib/api/billing"
import { getPaddle, subscribeToPaddleEvents } from "@/lib/paddle"
import { usePaddlePricing } from "@/lib/paddle-pricing"
import type { BillingCycle, SubscriptionPlan } from "@/types/billing"

const PADDLE_FRAME_TARGET = "coreassist-paddle-checkout"
const BILLING_SYNC_TIMEOUT_MS = 20_000
const BILLING_SYNC_INTERVAL_MS = 600

export function BillingCheckout({
  workspaceId,
  customerEmail,
  plan,
  billingCycle,
}: {
  workspaceId: string
  customerEmail: string
  plan: SubscriptionPlan
  billingCycle: BillingCycle
}) {
  const [attempt, setAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [pendingCheckoutHref, setPendingCheckoutHref] = useState<string | null>(
    null
  )
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = useState<string | null>(
    null
  )
  const mountedRef = useRef(false)
  const completionStartedRef = useRef(false)
  const completionAbortRef = useRef<AbortController | null>(null)
  const paddleRef = useRef<Awaited<ReturnType<typeof getPaddle>> | null>(null)
  const pricing = usePaddlePricing()
  const price = pricing.prices?.[plan.id][billingCycle] ?? null

  const completeCheckout = useCallback(async () => {
    completionAbortRef.current?.abort()
    const controller = new AbortController()
    completionAbortRef.current = controller
    setIsCompleting(true)
    setCompletionError(null)

    try {
      await waitForBillingSync({
        workspaceId,
        planId: plan.id,
        billingCycle,
        signal: controller.signal,
      })

      if (!mountedRef.current || controller.signal.aborted) return
      window.location.replace(
        `${billingRoutes(workspaceId).overview}?checkout=success`
      )
    } catch (syncError) {
      if (!mountedRef.current || controller.signal.aborted) return
      setIsCompleting(false)
      setCompletionError(
        syncError instanceof Error
          ? syncError.message
          : "Ödeme alındı ancak abonelik bilgileri henüz güncellenemedi."
      )
    }
  }, [billingCycle, plan.id, workspaceId])

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()

    const unsubscribe = subscribeToPaddleEvents((event) => {
      if (!mountedRef.current) return

      if (event.name === "checkout.loaded") {
        setIsLoading(false)
      }

      if (event.name === "checkout.error" || event.name === "checkout.failed") {
        setIsLoading(false)
        setError(
          event.detail ??
            "Ödeme formu yüklenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin."
        )
      }

      if (
        event.name === "checkout.completed" &&
        !completionStartedRef.current
      ) {
        completionStartedRef.current = true
        void completeCheckout()
      }
    })

    void (async () => {
      try {
        const deadline = Date.now() + 20_000
        let checkout = await createBillingCheckout(
          workspaceId,
          plan.id,
          billingCycle,
          controller.signal
        )
        while (checkout.state === "preparing" && Date.now() < deadline) {
          await wait(1_000, controller.signal)
          checkout = await createBillingCheckout(
            workspaceId,
            plan.id,
            billingCycle,
            controller.signal
          )
        }

        if (!mountedRef.current || controller.signal.aborted) return

        if (checkout.state === "plan_conflict") {
          setPendingCheckoutHref(
            `${APP_ROUTES.checkout}?workspaceId=${encodeURIComponent(workspaceId)}&plan=${checkout.plan.toLowerCase()}&cycle=${checkout.cycle.toLowerCase()}`
          )
          setPendingCheckoutPlan(formatPlanName(checkout.plan))

          if (checkout.canCancel) {
            await cancelPendingBillingCheckout(workspaceId)
            setPendingCheckoutHref(null)
            setPendingCheckoutPlan(null)
            checkout = await createBillingCheckout(
              workspaceId,
              plan.id,
              billingCycle,
              controller.signal
            )
            while (checkout.state === "preparing" && Date.now() < deadline) {
              await wait(1_000, controller.signal)
              checkout = await createBillingCheckout(
                workspaceId,
                plan.id,
                billingCycle,
                controller.signal
              )
            }
          }
        }

        if (checkout.state === "plan_conflict") {
          throw new Error(
            checkout.canCancel
              ? "Bekleyen ödeme değiştirilemedi. Mevcut işleminize devam edebilir veya daha sonra tekrar deneyebilirsiniz."
              : "Mevcut ödemeniz işleniyor. Abonelik bilgileriniz güncellenene kadar başka bir plan seçilemez."
          )
        }
        if (checkout.state === "payment_pending") {
          setIsLoading(false)
          completionStartedRef.current = true
          await completeCheckout()
          return
        }
        if (checkout.state === "preparing") {
          throw new Error(
            "Ödeme işleminiz hâlâ hazırlanıyor. Birkaç saniye sonra tekrar deneyin; mevcut işlem kullanılacaktır."
          )
        }
        if (!checkout.transactionId)
          throw new Error("Ödeme işlemi henüz hazır değil.")
        const paddle = await getPaddle()
        if (!mountedRef.current || controller.signal.aborted) return

        paddleRef.current?.Checkout.close()
        paddleRef.current = paddle
        paddle.Checkout.open({
          transactionId: checkout.transactionId,
          customer: { email: customerEmail },
          settings: {
            displayMode: "inline",
            variant: "one-page",
            frameTarget: PADDLE_FRAME_TARGET,
            frameInitialHeight: 650,
            frameStyle:
              "width: 100%; min-width: 286px; background-color: transparent; border: none;",
            locale: "tr",
            theme: document.documentElement.classList.contains("dark")
              ? "dark"
              : "light",
            allowLogout: false,
          },
        })
      } catch (checkoutError) {
        if (!mountedRef.current || controller.signal.aborted) return
        setIsLoading(false)
        setError(
          checkoutError instanceof Error
            ? checkoutError.message
            : "Ödeme adımı şu anda başlatılamadı. Lütfen tekrar deneyin."
        )
      }
    })()

    return () => {
      mountedRef.current = false
      controller.abort()
      completionAbortRef.current?.abort()
      unsubscribe()
      window.setTimeout(() => {
        if (!mountedRef.current) paddleRef.current?.Checkout.close()
      }, 0)
    }
  }, [
    attempt,
    billingCycle,
    completeCheckout,
    customerEmail,
    plan.id,
    workspaceId,
  ])

  function retryCheckout() {
    paddleRef.current?.Checkout.close()
    setIsLoading(true)
    setError(null)
    setCompletionError(null)
    setPendingCheckoutHref(null)
    setPendingCheckoutPlan(null)
    completionStartedRef.current = false
    setAttempt((current) => current + 1)
  }

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_28%),radial-gradient(circle_at_92%_18%,color-mix(in_oklab,var(--primary)_5%,transparent),transparent_24%),linear-gradient(to_bottom,color-mix(in_oklab,var(--muted)_22%,transparent),transparent_52%)]"
      />

      <header className="relative z-30 bg-background/65 backdrop-blur-xl">
        <div className="mx-auto flex h-17 w-full max-w-[1180px] items-center justify-between gap-4 border-b border-border/60 px-5 sm:px-8">
          <AppLogo href={billingRoutes(workspaceId).plans} />
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-2 text-[11px] font-medium text-muted-foreground md:flex">
              <HugeiconsIcon
                icon={ShieldCheckIcon}
                className="size-3.5 text-primary"
              />
              Paddle ile güvenli ödeme
            </span>
            <Button asChild variant="ghost" size="sm" className="-mr-2">
              <Link href={billingRoutes(workspaceId).plans}>
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                <span className="hidden sm:inline">Planlara dön</span>
                <span className="sm:hidden">Geri</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-8 sm:px-8 sm:py-11 lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1.18fr)] lg:gap-18 lg:py-14">
        <section className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-9 flex items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="size-3.5"
                />
              </span>
              Plan seçimi
            </span>
            <span className="h-px w-9 bg-border" />
            <span className="flex items-center gap-2 text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full border border-primary/25 bg-primary/8 text-[10px] font-semibold text-primary">
                2
              </span>
              Ödeme
            </span>
          </div>

          <p className="text-xs font-medium text-primary">Seçtiğiniz plan</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-[2.6rem] sm:leading-[1.08]">
            {plan.name} ile devam edin
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            {plan.description}
          </p>

          <div className="mt-8 rounded-2xl bg-card/75 p-5 shadow-[0_18px_55px_-38px_color-mix(in_oklab,var(--foreground)_30%,transparent)] ring-1 ring-border/60 backdrop-blur-sm sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {billingCycle === "annual"
                    ? "Yıllık faturalandırma"
                    : "Aylık faturalandırma"}
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-[-0.04em] tabular-nums">
                  {price?.monthly ?? "—"}
                  <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">
                    / ay
                  </span>
                </p>
              </div>
              {billingCycle === "annual" && price?.discountPercentage ? (
                <span className="rounded-full bg-primary/9 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/12">
                  %
                  {price.discountPercentage.toLocaleString("tr-TR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  tasarruf
                </span>
              ) : null}
            </div>

            <dl className="mt-6 divide-y divide-border/55 border-t border-border/55">
              <SummaryRow
                label="Aylık soru hakkı"
                value={plan.questions.toLocaleString("tr-TR")}
              />
              <SummaryRow
                label="Mağaza ve kullanıcı"
                value={`${plan.stores} mağaza · ${plan.members} kullanıcı`}
              />
              <SummaryRow label="Pazaryerleri" value={INCLUDED_MARKETPLACES} />
              <SummaryRow
                label={
                  billingCycle === "annual" ? "Yıllık toplam" : "Ara toplam"
                }
                value={price?.total ?? "Paddle ödeme formunda"}
                emphasized
              />
            </dl>
            {pricing.loading ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Güncel fiyat Paddle üzerinden hesaplanıyor.
              </p>
            ) : pricing.error ? (
              <button
                type="button"
                className="mt-3 text-left text-[11px] font-medium text-primary underline underline-offset-4"
                onClick={pricing.retry}
              >
                Fiyat özeti alınamadı. Yeniden deneyin.
              </button>
            ) : null}
          </div>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {plan.features.slice(0, 4).map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="mt-0.5 size-3.5 shrink-0 text-primary"
                />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-start gap-3 border-t border-border/60 pt-5">
            <HugeiconsIcon
              icon={ShieldCheckIcon}
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            <p className="max-w-md text-[11px] leading-5 text-muted-foreground">
              Ödeme bilgileriniz CoreAssist sunucularında tutulmaz. Vergiler,
              ödeme adresinize göre Paddle tarafından ödeme adımında hesaplanır.
            </p>
          </div>
        </section>

        <section aria-labelledby="payment-heading" className="min-w-0">
          <div className="overflow-hidden rounded-[1.4rem] bg-card/90 shadow-[0_30px_90px_-52px_color-mix(in_oklab,var(--foreground)_38%,transparent)] ring-1 ring-border/65 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <p className="text-[11px] font-medium text-primary">
                  Güvenli ödeme
                </p>
                <h2
                  id="payment-heading"
                  className="mt-1 text-lg font-semibold tracking-tight"
                >
                  Aboneliğinizi tamamlayın
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bilgilerinizi girin ve planınızı etkinleştirin.
                </p>
              </div>
            </div>

            <div className="relative min-h-[650px] border-t border-border/55 bg-background/28 px-4">
              {isLoading ? <CheckoutLoading /> : null}
              {isCompleting || completionError ? (
                <CheckoutCompletion
                  isCompleting={isCompleting}
                  error={completionError}
                  onRetry={() => void completeCheckout()}
                />
              ) : null}
              {error ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-card p-6">
                  <div className="max-w-sm text-center">
                    <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                      <HugeiconsIcon
                        icon={AlertCircleIcon}
                        className="size-5"
                      />
                    </span>
                    <h3 className="mt-4 font-semibold">
                      Ödeme formu açılamadı
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {error}
                    </p>
                    {pendingCheckoutHref ? (
                      <div className="mt-5 flex flex-col items-stretch gap-2">
                        <Button asChild size="sm">
                          <Link href={pendingCheckoutHref}>
                            {pendingCheckoutPlan
                              ? `${pendingCheckoutPlan} ödemesine devam et`
                              : "Mevcut ödemeye dön"}
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-5"
                        onClick={retryCheckout}
                      >
                        Tekrar dene
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
              <div className={`${PADDLE_FRAME_TARGET} min-h-[650px] w-full`} />
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] leading-4 text-muted-foreground">
            Ödeme adımını tamamlayarak Paddle’ın satış ve gizlilik koşullarını
            kabul etmiş olursunuz.
          </p>
        </section>
      </div>
    </main>
  )
}

function formatPlanName(plan: "STARTER" | "GROWTH" | "BUSINESS") {
  return `${plan.charAt(0)}${plan.slice(1).toLowerCase()}`
}

function CheckoutCompletion({
  isCompleting,
  error,
  onRetry,
}: {
  isCompleting: boolean
  error: string | null
  onRetry: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-card p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon
            icon={isCompleting ? Loading03Icon : CheckmarkCircle01Icon}
            className={isCompleting ? "size-5 animate-spin" : "size-5"}
          />
        </span>
        <h3 className="mt-5 text-base font-semibold">
          {isCompleting
            ? "Aboneliğiniz kontrol ediliyor"
            : "Doğrulama bekleniyor"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isCompleting
            ? "Paddle doğrulaması tamamlanıyor. Bu işlem genellikle birkaç saniye sürer."
            : error}
        </p>
        {!isCompleting ? (
          <Button type="button" size="sm" className="mt-5" onClick={onRetry}>
            Aboneliği kontrol et
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: string
  emphasized?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-3.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasized
            ? "font-semibold text-foreground"
            : "font-medium text-foreground/85"
        }
      >
        {value}
      </dd>
    </div>
  )
}

function CheckoutLoading() {
  return (
    <div className="absolute inset-0 z-10 bg-card/95 p-6 sm:p-8">
      <div className="flex items-center gap-3 border-b border-border/55 pb-6">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/9 text-primary">
          <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
        </span>
        <div>
          <p className="text-sm font-medium">Ödeme formu hazırlanıyor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Güvenli bağlantı kuruluyor…
          </p>
        </div>
      </div>
      <div className="mt-7 animate-pulse space-y-5">
        <div className="h-11 rounded-xl bg-muted/70" />
        <div className="h-11 rounded-xl bg-muted/70" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-11 rounded-xl bg-muted/70" />
          <div className="h-11 rounded-xl bg-muted/70" />
        </div>
        <div className="h-11 rounded-xl bg-muted/70" />
        <div className="mt-12 h-12 rounded-xl bg-primary/8" />
      </div>
    </div>
  )
}

async function waitForBillingSync({
  workspaceId,
  planId,
  billingCycle,
  signal,
}: {
  workspaceId: string
  planId: SubscriptionPlan["id"]
  billingCycle: BillingCycle
  signal: AbortSignal
}) {
  const expectedPlan = planId.toUpperCase()
  const expectedCycle = billingCycle.toUpperCase()
  const deadline = Date.now() + BILLING_SYNC_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const summary = await getBillingSummary(workspaceId, signal)
      if (
        summary.subscription.managedByPaddle &&
        summary.subscription.active &&
        summary.subscription.plan === expectedPlan &&
        summary.subscription.cycle === expectedCycle
      ) {
        return
      }
    } catch (error) {
      if (signal.aborted) throw error
    }

    await wait(BILLING_SYNC_INTERVAL_MS, signal)
  }

  throw new Error(
    "Ödeme işleminizin sonucu henüz panele yansımadı. Yeniden ödeme yapmadan birkaç saniye sonra aboneliğinizi tekrar kontrol edin."
  )
}

function wait(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("İşlem iptal edildi.", "AbortError"))
      return
    }
    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException("İşlem iptal edildi.", "AbortError"))
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort)
      resolve()
    }, duration)
    signal.addEventListener("abort", handleAbort, { once: true })
  })
}
