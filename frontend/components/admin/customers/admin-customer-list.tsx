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
  Package01Icon,
  Search01Icon,
  UserGroupIcon,
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
  AdminCustomerList,
  AdminCustomerPlan,
  AdminCustomerQuery,
  AdminCustomerSummary,
} from "@/types/admin-customer"
import type { BillingSubscriptionStatus } from "@/types/billing"
import {
  ADMIN_CUSTOMER_PLANS,
  ADMIN_CUSTOMER_SUBSCRIPTION_OPTIONS,
  ADMIN_CUSTOMER_SUBSCRIPTION_STATUS,
  adminPlanLabel,
  formatAdminCustomerRelativeDate,
  formatCompactNumber,
} from "./admin-customer-presentation"

const ALL = "ALL"

export function AdminCustomerListView({
  data,
  query,
}: {
  data: AdminCustomerList
  query: AdminCustomerQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [referenceTime] = useState(() => Date.now())
  const [isNavigating, startTransition] = useTransition()

  function navigate(changes: Partial<AdminCustomerQuery>) {
    const nextQuery: AdminCustomerQuery = {
      ...query,
      ...changes,
      page: changes.page ?? 1,
    }
    const params = toSearchParams(nextQuery)
    startTransition(() => {
      router.replace(
        params.size
          ? `${APP_ROUTES.admin.customers}?${params.toString()}`
          : APP_ROUTES.admin.customers
      )
    })
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate({ q: search.trim() || undefined })
  }

  const hasFilters = Boolean(
    query.q ||
    query.plan ||
    query.subscription ||
    query.onboarding ||
    (query.sort && query.sort !== "NEWEST")
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Müşteri yönetimi
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Müşteriler
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hesapların kullanım, mağaza ve abonelik durumunu tek yerden
            inceleyin.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Filtre sonucunda {data.pagination.total} çalışma alanı
        </p>
      </div>

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric
          label="Toplam hesap"
          value={data.summary.total}
          helper="Oluşturulan çalışma alanları"
          icon={UserGroupIcon}
        />
        <SummaryMetric
          label="Aktif"
          value={data.summary.active}
          helper="Ödemeli erişimi devam ediyor"
          icon={CheckmarkCircle01Icon}
          positive
        />
        <SummaryMetric
          label="Deneme"
          value={data.summary.trialing}
          helper="Deneme dönemindeki hesaplar"
          icon={CreditCardIcon}
        />
        <SummaryMetric
          label="Ödeme sorunu"
          value={data.summary.paymentIssues}
          helper="Gecikmiş veya duraklatılmış"
          icon={AlertCircleIcon}
          danger={data.summary.paymentIssues > 0}
        />
        <SummaryMetric
          label="Onboarding bekliyor"
          value={data.summary.pending}
          helper="Kurulumu henüz tamamlanmamış"
          icon={Package01Icon}
          attention={data.summary.pending > 0}
        />
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <form
              onSubmit={submitSearch}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kullanıcı, e-posta, çalışma alanı veya mağaza ara..."
                aria-label="Müşterilerde ara"
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
                options={ADMIN_CUSTOMER_PLANS}
                onValueChange={(value) =>
                  navigate({
                    plan:
                      value === ALL ? undefined : (value as AdminCustomerPlan),
                    subscription:
                      value !== ALL && query.subscription === "NONE"
                        ? undefined
                        : query.subscription,
                  })
                }
              />
              <FilterSelect
                label="Abonelik"
                value={query.subscription ?? ALL}
                options={ADMIN_CUSTOMER_SUBSCRIPTION_OPTIONS}
                onValueChange={(value) =>
                  navigate({
                    subscription:
                      value === ALL
                        ? undefined
                        : (value as BillingSubscriptionStatus | "NONE"),
                    plan: value === "NONE" ? undefined : query.plan,
                  })
                }
              />
              <FilterSelect
                label="Onboarding"
                value={query.onboarding ?? ALL}
                options={[
                  { value: "COMPLETED", label: "Tamamlandı" },
                  { value: "PENDING", label: "Bekliyor" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    onboarding:
                      value === ALL
                        ? undefined
                        : (value as "COMPLETED" | "PENDING"),
                  })
                }
              />
              <FilterSelect
                label="Sıralama"
                value={query.sort ?? "NEWEST"}
                includeAll={false}
                options={[
                  { value: "NEWEST", label: "En yeni" },
                  { value: "OLDEST", label: "En eski" },
                  { value: "NAME", label: "Ada göre" },
                ]}
                onValueChange={(value) =>
                  navigate({ sort: value as "NEWEST" | "OLDEST" | "NAME" })
                }
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="flex items-center justify-between border-t border-border/70 pt-3">
              <p className="text-[11px] text-muted-foreground">
                Aktif filtreler URL üzerinde korunur.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  startTransition(() =>
                    router.replace(APP_ROUTES.admin.customers)
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
          <div className="hidden grid-cols-[minmax(280px,1.3fr)_160px_minmax(220px,0.9fr)_170px_140px] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:grid">
            <span>Hesap</span>
            <span>Abonelik</span>
            <span>Kapasite</span>
            <span>AI kullanımı</span>
            <span className="text-right">Son etkinlik</span>
          </div>

          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  referenceTime={referenceTime}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={UserGroupIcon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">
                Bu filtrelerle eşleşen müşteri yok
              </p>
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

function CustomerRow({
  customer,
  referenceTime,
}: {
  customer: AdminCustomerSummary
  referenceTime: number
}) {
  const subscriptionPresentation = customer.subscription
    ? ADMIN_CUSTOMER_SUBSCRIPTION_STATUS[customer.subscription.status]
    : null
  const used = customer.usage?.aiQuestions ?? 0
  const limit = customer.limits?.aiQuestions ?? 0
  const percentage = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <Link
      href={APP_ROUTES.admin.customer(customer.id)}
      className="group grid gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5 xl:grid-cols-[minmax(280px,1.3fr)_160px_minmax(220px,0.9fr)_170px_140px] xl:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={customer.owner.image ?? undefined} />
          <AvatarFallback className="text-[11px]">
            {getInitials(customer.owner.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{customer.name}</h2>
            {!customer.onboardingCompleted ? (
              <span className="shrink-0 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                Kurulum bekliyor
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {customer.owner.name} · {customer.owner.email}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:block">
        <p className="text-xs font-semibold">
          {adminPlanLabel(customer.subscription?.plan)}
        </p>
        {subscriptionPresentation ? (
          <Badge
            variant="outline"
            className={cn(
              "mt-1.5 px-2 py-0 text-[9px]",
              subscriptionPresentation.className
            )}
          >
            {subscriptionPresentation.label}
          </Badge>
        ) : (
          <span className="mt-1.5 block text-[10px] text-muted-foreground">
            Abonelik yok
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <CapacityValue label="Mağaza" value={customer.counts.activeStores} />
        <CapacityValue label="Kullanıcı" value={customer.counts.members} />
        <CapacityValue
          label="Ürün"
          value={customer.counts.activeProducts}
          compact
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-medium tabular-nums">
            {formatCompactNumber(used)} /{" "}
            {limit ? formatCompactNumber(limit) : "—"}
          </span>
          <span className="text-muted-foreground">%{percentage}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-[width]",
              percentage >= 90 && "bg-amber-500",
              percentage >= 100 && "bg-destructive"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {customer.counts.openSupportTickets ? (
          <p className="mt-1.5 text-[9px] text-amber-700 dark:text-amber-400">
            {customer.counts.openSupportTickets} açık destek talebi
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 xl:justify-end">
        <div className="xl:text-right">
          <p className="text-xs font-medium">
            {formatAdminCustomerRelativeDate(
              customer.lastActiveAt,
              referenceTime
            )}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {customer.owner.emailVerified
              ? "E-posta doğrulandı"
              : "Doğrulanmadı"}
          </p>
        </div>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground xl:hidden"
        />
      </div>
    </Link>
  )
}

function CapacityValue({
  label,
  value,
  compact = false,
}: {
  label: string
  value: number
  compact?: boolean
}) {
  return (
    <div>
      <p className="font-semibold tabular-nums">
        {compact ? formatCompactNumber(value) : value.toLocaleString("tr-TR")}
      </p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  helper,
  icon,
  positive = false,
  attention = false,
  danger = false,
}: {
  label: string
  value: number
  helper: string
  icon: IconSvgElement
  positive?: boolean
  attention?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0 sm:[&:nth-child(odd)]:border-r">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          positive &&
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          attention && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          danger && "bg-destructive/10 text-destructive"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
          <span className="truncate text-xs font-medium">{label}</span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
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
  onValueChange,
  includeAll = true,
}: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onValueChange: (value: string) => void
  includeAll?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className="h-9 min-w-0 rounded-xl border-border bg-background sm:w-auto sm:min-w-34"
        aria-label={`${label} filtresi`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
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

function toSearchParams(query: AdminCustomerQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.plan) params.set("plan", query.plan)
  if (query.subscription) params.set("subscription", query.subscription)
  if (query.onboarding) params.set("onboarding", query.onboarding)
  if (query.sort && query.sort !== "NEWEST") params.set("sort", query.sort)
  if (query.page && query.page > 1) params.set("page", String(query.page))
  return params
}
