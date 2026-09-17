"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CreditCardIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import { cn, getInitials } from "@/lib/utils"
import type {
  AdminBillingList,
  AdminBillingPlan,
  AdminBillingQuery,
  AdminBillingSummary,
} from "@/types/admin-billing"
import type { BillingSubscriptionStatus } from "@/types/billing"
import {
  ADMIN_BILLING_PLANS,
  ADMIN_BILLING_STATUS,
  adminBillingCycleLabel,
  adminBillingPlanLabel,
  formatAdminBillingDay,
  formatAdminBillingNumber,
} from "./admin-billing-presentation"

const ALL = "ALL"

export function AdminBillingListView({
  data,
  query,
}: {
  data: AdminBillingList
  query: AdminBillingQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [isNavigating, startTransition] = useTransition()

  function navigate(changes: Partial<AdminBillingQuery>) {
    const nextQuery: AdminBillingQuery = {
      ...query,
      ...changes,
      page: changes.page ?? 1,
    }
    const params = toSearchParams(nextQuery)
    startTransition(() => {
      router.replace(
        params.size
          ? `${APP_ROUTES.admin.billing}?${params.toString()}`
          : APP_ROUTES.admin.billing
      )
    })
  }

  const hasFilters = Boolean(
    query.q ||
    query.plan ||
    query.status ||
    query.issue ||
    (query.sort && query.sort !== "UPDATED")
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Finans operasyonu
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Abonelikler
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ödeme sağlığını, bekleyen işlemleri ve Paddle eşleşmelerini izleyin.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Filtre sonucunda {data.pagination.total} abonelik
        </p>
      </div>

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric
          label="Toplam abonelik"
          value={data.summary.total}
          helper="Yerel abonelik kayıtları"
          icon={CreditCardIcon}
        />
        <SummaryMetric
          label="Aktif"
          value={data.summary.active}
          helper="Ödemeli abonelikler"
          icon={CheckmarkCircle01Icon}
          tone="positive"
        />
        <SummaryMetric
          label="Ödeme sorunu"
          value={data.summary.paymentIssues}
          helper="Gecikmiş veya duraklatılmış"
          icon={AlertCircleIcon}
          tone={data.summary.paymentIssues ? "danger" : "neutral"}
        />
        <SummaryMetric
          label="Uzlaştırma sorunu"
          value={data.summary.reconciliationIssues}
          helper="Paddle kontrolü hata verdi"
          icon={RefreshIcon}
          tone={data.summary.reconciliationIssues ? "danger" : "neutral"}
        />
        <SummaryMetric
          label="Bekleyen işlem"
          value={data.summary.pendingOperations}
          helper="Checkout veya plan değişimi"
          icon={RefreshIcon}
          tone={data.summary.pendingOperations ? "attention" : "neutral"}
        />
      </section>

      <section className="mt-6">
        <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                navigate({ q: search.trim() || undefined })
              }}
            >
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Çalışma alanı, kullanıcı, e-posta veya Paddle kimliği ara..."
                aria-label="Aboneliklerde ara"
                icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
                endIcon={
                  search ? (
                    <button
                      type="button"
                      className="pointer-events-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Aramayı temizle"
                      onClick={() => {
                        setSearch("")
                        if (query.q) navigate({ q: undefined })
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </button>
                  ) : null
                }
                className="h-10 min-w-0 flex-1 bg-background shadow-none"
              />
              <Button type="submit" size="sm" variant="outline">
                Ara
              </Button>
            </form>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
              <FilterSelect
                label="Plan"
                value={query.plan ?? ALL}
                options={ADMIN_BILLING_PLANS}
                onValueChange={(value) =>
                  navigate({
                    plan:
                      value === ALL ? undefined : (value as AdminBillingPlan),
                  })
                }
              />
              <FilterSelect
                label="Durum"
                value={query.status ?? ALL}
                options={Object.entries(ADMIN_BILLING_STATUS).map(
                  ([value, item]) => ({ value, label: item.label })
                )}
                onValueChange={(value) =>
                  navigate({
                    status:
                      value === ALL
                        ? undefined
                        : (value as BillingSubscriptionStatus),
                  })
                }
              />
              <FilterSelect
                label="Sorun"
                value={query.issue ?? ALL}
                options={[
                  { value: "PAYMENT", label: "Ödeme sorunu" },
                  { value: "RECONCILIATION", label: "Uzlaştırma sorunu" },
                  { value: "CHECKOUT", label: "Bekleyen ödeme" },
                  { value: "PLAN_CHANGE", label: "Plan değişikliği" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    issue:
                      value === ALL
                        ? undefined
                        : (value as NonNullable<AdminBillingQuery["issue"]>),
                  })
                }
              />
              <FilterSelect
                label="Sıralama"
                value={query.sort ?? "UPDATED"}
                includeAll={false}
                options={[
                  { value: "UPDATED", label: "Son güncellenen" },
                  { value: "PERIOD_END", label: "Dönem bitişi" },
                  { value: "FAILURES", label: "Kontrol hataları" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    sort: value as NonNullable<AdminBillingQuery["sort"]>,
                  })
                }
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
              <p className="text-[11px] text-muted-foreground">
                Filtreler URL üzerinde korunur.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  startTransition(() =>
                    router.replace(APP_ROUTES.admin.billing)
                  )
                }}
              >
                Filtreleri temizle
              </Button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-opacity",
            isNavigating && "pointer-events-none opacity-60"
          )}
        >
          <div className="hidden grid-cols-[minmax(270px,1.25fr)_170px_185px_190px_minmax(200px,0.8fr)] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:grid">
            <span>Hesap</span>
            <span>Plan</span>
            <span>Dönem</span>
            <span>AI kullanımı</span>
            <span>İşlem sağlığı</span>
          </div>

          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((subscription) => (
                <BillingRow key={subscription.id} subscription={subscription} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={CreditCardIcon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">Abonelik bulunamadı</p>
              <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                Arama ifadesini veya seçili filtreleri değiştirerek tekrar
                deneyin.
              </p>
            </div>
          )}

          {data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Sayfa {data.pagination.page} / {data.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={data.pagination.page <= 1 || isNavigating}
                  onClick={() => navigate({ page: data.pagination.page - 1 })}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Önceki
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    data.pagination.page >= data.pagination.totalPages ||
                    isNavigating
                  }
                  onClick={() => navigate({ page: data.pagination.page + 1 })}
                >
                  Sonraki
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function BillingRow({ subscription }: { subscription: AdminBillingSummary }) {
  const status = ADMIN_BILLING_STATUS[subscription.status]
  const used = subscription.usage?.aiQuestions ?? 0
  const limit = subscription.usage?.limit ?? 0
  const percentage = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const operation = subscription.pendingPlanChange
    ? "Plan değişikliği bekliyor"
    : subscription.pendingCheckout
      ? "Ödeme işlemi bekliyor"
      : null
  const unhealthy = Boolean(
    subscription.reconcileFailures || subscription.reconcileErrorCode
  )

  return (
    <Link
      href={APP_ROUTES.admin.billingWorkspace(subscription.workspace.id)}
      className="group grid gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5 xl:grid-cols-[minmax(270px,1.25fr)_170px_185px_190px_minmax(200px,0.8fr)] xl:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={subscription.workspace.owner.image ?? undefined} />
          <AvatarFallback className="text-[11px]">
            {getInitials(subscription.workspace.owner.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {subscription.workspace.name}
          </h2>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {subscription.workspace.owner.name} ·{" "}
            {subscription.workspace.owner.email}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold">
          {adminBillingPlanLabel(subscription.plan)} ·{" "}
          {adminBillingCycleLabel(subscription.cycle)}
        </p>
        <Badge
          variant="outline"
          className={cn("mt-1.5 px-2 py-0 text-[9px]", status.className)}
        >
          {status.label}
        </Badge>
      </div>

      <div>
        <p className="text-xs font-medium">
          {formatAdminBillingDay(subscription.currentPeriodEnd)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {subscription.cancelAtPeriodEnd
            ? "Dönem sonunda iptal"
            : "Dönem bitişi"}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-medium tabular-nums">
            {formatAdminBillingNumber(used)} /{" "}
            {limit ? formatAdminBillingNumber(limit) : "—"}
          </span>
          <span className="text-muted-foreground">%{percentage}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full bg-primary",
              percentage >= 90 && "bg-amber-500",
              percentage >= 100 && "bg-destructive"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="min-w-0">
        {unhealthy ? (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              className="size-3.5 shrink-0"
            />
            {subscription.reconcileFailures} kontrol hatası
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="size-3.5 shrink-0"
            />
            Paddle kaydı sağlıklı
          </p>
        )}
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {operation ??
            (subscription.lastReconciledAt
              ? "Bekleyen işlem yok"
              : "İlk kontrol bekleniyor")}
        </p>
      </div>
    </Link>
  )
}

function SummaryMetric({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  label: string
  value: number
  helper: string
  icon: IconSvgElement
  tone?: "neutral" | "positive" | "attention" | "danger"
}) {
  return (
    <div className="flex items-center gap-3 border-border p-4 not-first:border-t sm:odd:border-r sm:nth-[2]:border-t-0 xl:not-first:border-t-0 xl:not-last:border-r">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          tone === "positive" &&
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          tone === "attention" &&
            "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          tone === "danger" && "bg-destructive/10 text-destructive"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-[11px] font-medium">{label}</p>
        <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
          {helper}
        </p>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  includeAll = true,
  onValueChange,
}: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  includeAll?: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="min-w-36 bg-background">
        <span className="sr-only">{label}</span>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value={ALL}>{label}: Tümü</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function toSearchParams(query: AdminBillingQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  if (params.get("page") === "1") params.delete("page")
  if (params.get("pageSize") === "25") params.delete("pageSize")
  if (params.get("sort") === "UPDATED") params.delete("sort")
  return params
}
