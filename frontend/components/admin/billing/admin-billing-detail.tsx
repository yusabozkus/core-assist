"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { reconcileAdminBilling } from "@/lib/api/admin-billing"
import { cn } from "@/lib/utils"
import type {
  AdminBillingCheckout,
  AdminBillingDetail,
  AdminBillingPlanChange,
} from "@/types/admin-billing"
import {
  ADMIN_BILLING_STATUS,
  ADMIN_CHECKOUT_STATUS,
  ADMIN_PLAN_CHANGE_STATUS,
  adminBillingCycleLabel,
  adminBillingPlanLabel,
  adminPaddleEnvironmentLabel,
  formatAdminBillingDate,
  formatAdminBillingNumber,
} from "./admin-billing-presentation"

export function AdminBillingDetailView({
  initialBilling,
}: {
  initialBilling: AdminBillingDetail
}) {
  const [billing, setBilling] = useState(initialBilling)
  const [isReconciling, setIsReconciling] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const status = ADMIN_BILLING_STATUS[billing.status]
  const usage = billing.usage
  const usagePercentage = usage
    ? Math.min(
        100,
        Math.round(
          (usage.aiQuestions / usage.limit) * 100
        )
      )
    : 0

  async function reconcile() {
    if (isReconciling) return
    setIsReconciling(true)
    setFeedback(null)
    try {
      setBilling(await reconcileAdminBilling(billing.workspace.id))
      setFeedback({
        type: "success",
        message:
          "Paddle kaydı doğrulandı ve yerel abonelik görünümü yenilendi.",
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Paddle kaydı şu anda doğrulanamadı.",
      })
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <Link
            href={APP_ROUTES.admin.billing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
            Aboneliklere dön
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {billing.workspace.name}
            </h1>
            <Badge
              variant="outline"
              className={cn("px-2.5 py-0.5 text-[10px]", status.className)}
            >
              {status.label}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {billing.workspace.owner.name} · {billing.workspace.owner.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={APP_ROUTES.admin.customer(billing.workspace.id)}>
              Müşteri hesabını aç
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isReconciling}
            onClick={reconcile}
          >
            <HugeiconsIcon
              icon={isReconciling ? Loading03Icon : RefreshIcon}
              className={cn("size-3.5", isReconciling && "animate-spin")}
            />
            {isReconciling ? "Doğrulanıyor" : "Paddle’dan doğrula"}
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={cn(
            "mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs",
            feedback.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/20 bg-destructive/8 text-destructive"
          )}
        >
          <HugeiconsIcon
            icon={
              feedback.type === "success"
                ? CheckmarkCircle01Icon
                : AlertCircleIcon
            }
            className="mt-0.5 size-3.5 shrink-0"
          />
          {feedback.message}
        </div>
      ) : null}

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
        <OverviewValue
          label="Plan"
          value={`${adminBillingPlanLabel(billing.plan)} · ${adminBillingCycleLabel(billing.cycle)}`}
          helper={billing.hasAccess ? "Erişim açık" : "Erişim kapalı"}
          positive={billing.hasAccess}
        />
        <OverviewValue
          label="Dönem bitişi"
          value={formatAdminBillingDate(billing.currentPeriodEnd)}
          helper={
            billing.cancelAtPeriodEnd
              ? "Dönem sonunda iptal"
              : "Yenileme bekleniyor"
          }
        />
        <OverviewValue
          label="AI soru kullanımı"
          value={`${formatAdminBillingNumber(usage?.aiQuestions ?? 0)} / ${formatAdminBillingNumber(usage?.limit ?? billing.entitlements.monthlyAiQuestions)}`}
          helper={`Kota kullanımı %${usagePercentage}`}
        />
        <OverviewValue
          label="Paddle kontrolü"
          value={
            billing.reconcileFailures
              ? `${billing.reconcileFailures} başarısız deneme`
              : "Sağlıklı"
          }
          helper={
            billing.lastReconciledAt
              ? formatAdminBillingDate(billing.lastReconciledAt)
              : "Henüz kontrol edilmedi"
          }
          danger={billing.reconcileFailures > 0}
          positive={billing.reconcileFailures === 0}
        />
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div>
            <p className="text-xs font-semibold">Abonelik yaşam döngüsü</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Paddle’dan doğrulanan plan, dönem ve erişim bilgileri.
            </p>
          </div>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <DetailValue
              label="Başlangıç"
              value={formatAdminBillingDate(billing.currentPeriodStart)}
            />
            <DetailValue
              label="Bitiş"
              value={formatAdminBillingDate(billing.currentPeriodEnd)}
            />
            <DetailValue
              label="Deneme bitişi"
              value={formatAdminBillingDate(billing.trialEndsAt)}
            />
            <DetailValue
              label="İptal tarihi"
              value={formatAdminBillingDate(billing.canceledAt)}
            />
            <DetailValue
              label="Planlı erişim bitişi"
              value={formatAdminBillingDate(billing.scheduledAccessEndsAt)}
            />
            <DetailValue
              label="Son Paddle güncellemesi"
              value={formatAdminBillingDate(billing.paddleUpdatedAt)}
            />
          </dl>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-semibold">Plan kapasitesi</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Capacity
                label="AI sorusu"
                value={billing.entitlements.monthlyAiQuestions}
              />
              <Capacity label="Mağaza" value={billing.entitlements.stores} />
              <Capacity
                label="Kullanıcı"
                value={billing.entitlements.members}
              />
              <Capacity
                label="Ürün"
                value={billing.entitlements.activeProducts}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Uzlaştırma sağlığı</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Yerel kayıt ile Paddle arasındaki son kontrol.
              </p>
            </div>
            <span
              className={cn(
                "mt-0.5 size-2 rounded-full",
                billing.reconcileFailures ? "bg-destructive" : "bg-emerald-500"
              )}
            />
          </div>
          <dl className="mt-5 space-y-4">
            <DetailValue
              label="Son başarılı kontrol"
              value={formatAdminBillingDate(billing.lastReconciledAt)}
              horizontal
            />
            <DetailValue
              label="Sonraki otomatik kontrol"
              value={formatAdminBillingDate(billing.reconcileAfter)}
              horizontal
            />
            <DetailValue
              label="Başarısız deneme"
              value={String(billing.reconcileFailures)}
              horizontal
            />
            <DetailValue
              label="Hata kodu"
              value={billing.reconcileErrorCode ?? "—"}
              horizontal
              mono
            />
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-[10px] leading-5 text-muted-foreground">
            Manuel kontrol yerel durumu zorla değiştirmez; Paddle kaydı okunur
            ve yalnızca doğrulanan sonuç uygulanır.
          </p>
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-border bg-card p-5 shadow-xs">
        <p className="text-xs font-semibold">Paddle referansları</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Destek ve mutabakat sırasında kullanılacak salt okunur kimlikler.
        </p>
        <dl className="mt-5 grid gap-4 lg:grid-cols-3">
          <ReferenceValue label="Müşteri" value={billing.paddleCustomerId} />
          <ReferenceValue
            label="Abonelik"
            value={billing.paddleSubscriptionId}
          />
          <ReferenceValue label="Fiyat" value={billing.paddlePriceId} />
        </dl>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <SectionHeader
          title="Ödeme işlemleri"
          description="Son checkout kayıtları ve Paddle transaction eşleşmeleri."
          count={billing.checkouts.length}
        />
        {billing.checkouts.length ? (
          <div className="divide-y divide-border">
            {billing.checkouts.map((checkout) => (
              <CheckoutRow key={checkout.id} checkout={checkout} />
            ))}
          </div>
        ) : (
          <EmptyRow text="Bu çalışma alanında checkout kaydı yok." />
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <SectionHeader
          title="Plan değişiklikleri"
          description="Gönderilen değişiklikler, yeniden denemeler ve webhook sonuçları."
          count={billing.planChanges.length}
        />
        {billing.planChanges.length ? (
          <div className="divide-y divide-border">
            {billing.planChanges.map((change) => (
              <PlanChangeRow key={change.id} change={change} />
            ))}
          </div>
        ) : (
          <EmptyRow text="Bu çalışma alanında plan değişikliği yok." />
        )}
      </section>
    </main>
  )
}

function CheckoutRow({ checkout }: { checkout: AdminBillingCheckout }) {
  const problematic =
    checkout.status === "FAILED" || checkout.status === "REVIEW_REQUIRED"
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(210px,1fr)_170px_160px_minmax(240px,1fr)] md:items-center">
      <div>
        <p className="text-xs font-semibold">
          {adminBillingPlanLabel(checkout.plan)} ·{" "}
          {adminBillingCycleLabel(checkout.cycle)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatAdminBillingDate(checkout.createdAt)}
        </p>
      </div>
      <div>
        <p
          className={cn(
            "text-xs font-medium",
            problematic && "text-destructive"
          )}
        >
          {ADMIN_CHECKOUT_STATUS[checkout.status]}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {adminPaddleEnvironmentLabel(checkout.environment)}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {checkout.boundAt ? "Aboneliğe bağlandı" : "Bağlantı bekliyor"}
      </p>
      <ReferenceValue
        label="Transaction"
        value={checkout.paddleTransactionId}
        compact
      />
    </div>
  )
}

function PlanChangeRow({ change }: { change: AdminBillingPlanChange }) {
  const problematic =
    change.status === "FAILED" || change.status === "REVIEW_REQUIRED"
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(210px,1fr)_190px_190px_minmax(220px,1fr)] md:items-center">
      <div>
        <p className="text-xs font-semibold">
          {adminBillingPlanLabel(change.plan)} ·{" "}
          {adminBillingCycleLabel(change.cycle)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatAdminBillingDate(change.createdAt)}
        </p>
      </div>
      <div>
        <p
          className={cn(
            "text-xs font-medium",
            problematic && "text-destructive"
          )}
        >
          {ADMIN_PLAN_CHANGE_STATUS[change.status]}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {adminPaddleEnvironmentLabel(change.environment)}
        </p>
      </div>
      <div>
        <p className="text-[11px]">{change.retryCount ?? 0} yeniden deneme</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {change.retryAt
            ? `Sonraki: ${formatAdminBillingDate(change.retryAt)}`
            : change.completedAt
              ? `Bitti: ${formatAdminBillingDate(change.completedAt)}`
              : "Planlı tekrar yok"}
        </p>
      </div>
      <ReferenceValue label="Hata kodu" value={change.failureCode} compact />
    </div>
  )
}

function OverviewValue({
  label,
  value,
  helper,
  positive,
  danger,
}: {
  label: string
  value: string
  helper: string
  positive?: boolean
  danger?: boolean
}) {
  return (
    <div className="border-border p-4 not-first:border-t sm:odd:border-r sm:nth-[2]:border-t-0 xl:not-first:border-t-0 xl:not-last:border-r">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-sm font-semibold",
          positive && "text-emerald-700 dark:text-emerald-300",
          danger && "text-destructive"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{helper}</p>
    </div>
  )
}

function DetailValue({
  label,
  value,
  horizontal,
  mono,
}: {
  label: string
  value: string
  horizontal?: boolean
  mono?: boolean
}) {
  return (
    <div className={cn(horizontal && "flex items-start justify-between gap-4")}>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-xs font-medium",
          horizontal && "mt-0 text-right",
          mono && "font-mono text-[10px] break-all"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function Capacity({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/55 px-3 py-3">
      <p className="text-base font-semibold tabular-nums">
        {formatAdminBillingNumber(value)}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function ReferenceValue({
  label,
  value,
  compact,
}: {
  label: string
  value: string | null | undefined
  compact?: boolean
}) {
  return (
    <div className={cn(!compact && "rounded-lg bg-muted/45 px-3 py-3")}>
      <dt className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className="mt-1.5 truncate font-mono text-[10px]"
        title={value ?? undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  )
}

function SectionHeader({
  title,
  description,
  count,
}: {
  title: string
  description: string
  count: number
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-xs font-semibold">{title}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Badge variant="secondary" className="px-2 py-0 text-[10px]">
        {count}
      </Badge>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="px-5 py-9 text-center text-xs text-muted-foreground">
      {text}
    </p>
  )
}
