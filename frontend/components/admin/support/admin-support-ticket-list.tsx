"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  ClockAlertIcon,
  CustomerSupportIcon,
  InboxIcon,
  Search01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

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
import { SUPPORT_CATEGORY_OPTIONS } from "@/components/dashboard/support/support-ticket-presentation"
import { APP_ROUTES } from "@/constants/site"
import { cn, getInitials } from "@/lib/utils"
import type {
  AdminSupportTicketList,
  AdminSupportTicketQuery,
  AdminSupportTicketSummary,
} from "@/types/admin-support"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/support"
import {
  ADMIN_SUPPORT_PRIORITY,
  ADMIN_SUPPORT_PRIORITY_OPTIONS,
  ADMIN_SUPPORT_STATUS,
  ADMIN_SUPPORT_STATUS_OPTIONS,
  formatAdminSupportDate,
  formatAdminSupportRelativeDate,
} from "./admin-support-presentation"

const ALL = "ALL"

export function AdminSupportTicketList({
  data,
  query,
}: {
  data: AdminSupportTicketList
  query: AdminSupportTicketQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [referenceTime] = useState(() => Date.now())
  const [isNavigating, startTransition] = useTransition()

  function navigate(changes: Partial<AdminSupportTicketQuery>) {
    const nextQuery: AdminSupportTicketQuery = {
      ...query,
      ...changes,
      page: changes.page ?? 1,
    }
    const params = toSearchParams(nextQuery)

    startTransition(() => {
      router.replace(
        params.size
          ? `${APP_ROUTES.admin.support}?${params.toString()}`
          : APP_ROUTES.admin.support
      )
    })
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate({ q: search.trim() || undefined })
  }

  const hasFilters = Boolean(
    query.q ||
    query.status ||
    query.priority ||
    query.category ||
    query.assignee ||
    (query.sort && query.sort !== "LAST_ACTIVITY")
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Destek operasyonu
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Destek talepleri
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Müşteri taleplerini önceliklendirin, yanıtlayın ve sonuçlandırın.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Filtre sonucunda {data.pagination.total} talep
        </p>
      </div>

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Aktif talepler"
          value={data.summary.active}
          helper="İşlem akışındaki tüm talepler"
          icon={CustomerSupportIcon}
        />
        <SummaryMetric
          label="Atanmamış"
          value={data.summary.unassigned}
          helper="Henüz sorumlusu bulunmuyor"
          icon={UserGroupIcon}
          attention={data.summary.unassigned > 0}
        />
        <SummaryMetric
          label="Acil öncelik"
          value={data.summary.urgent}
          helper="Öncelikle ele alınmalı"
          icon={AlertCircleIcon}
          danger={data.summary.urgent > 0}
        />
        <SummaryMetric
          label="SLA aşıldı"
          value={data.summary.overdue}
          helper="İlk yanıt hedefi geçmiş"
          icon={ClockAlertIcon}
          danger={data.summary.overdue > 0}
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
                placeholder="Talep no, konu, müşteri veya mağaza ara..."
                aria-label="Destek taleplerinde ara"
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
                label="Durum"
                value={query.status ?? ALL}
                options={ADMIN_SUPPORT_STATUS_OPTIONS}
                onValueChange={(value) =>
                  navigate({
                    status:
                      value === ALL
                        ? undefined
                        : (value as SupportTicketStatus),
                  })
                }
              />
              <FilterSelect
                label="Öncelik"
                value={query.priority ?? ALL}
                options={ADMIN_SUPPORT_PRIORITY_OPTIONS}
                onValueChange={(value) =>
                  navigate({
                    priority:
                      value === ALL
                        ? undefined
                        : (value as SupportTicketPriority),
                  })
                }
              />
              <FilterSelect
                label="Kategori"
                value={query.category ?? ALL}
                options={SUPPORT_CATEGORY_OPTIONS}
                onValueChange={(value) =>
                  navigate({
                    category:
                      value === ALL
                        ? undefined
                        : (value as SupportTicketCategory),
                  })
                }
              />
              <FilterSelect
                label="Atama"
                value={query.assignee ?? ALL}
                options={[
                  { value: "ME", label: "Bana atanan" },
                  { value: "UNASSIGNED", label: "Atanmamış" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    assignee:
                      value === ALL
                        ? undefined
                        : (value as "ME" | "UNASSIGNED"),
                  })
                }
              />
              <FilterSelect
                label="Sıralama"
                value={query.sort ?? "LAST_ACTIVITY"}
                includeAll={false}
                options={[
                  { value: "LAST_ACTIVITY", label: "Son hareket" },
                  { value: "OLDEST", label: "En eski" },
                  { value: "SLA", label: "SLA önceliği" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    sort: value as "LAST_ACTIVITY" | "OLDEST" | "SLA",
                  })
                }
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="flex items-center justify-between border-t border-border/70 pt-3">
              <p className="text-[11px] text-muted-foreground">
                Aktif filtreler liste ve URL üzerinde korunur.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  startTransition(() =>
                    router.replace(APP_ROUTES.admin.support)
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
          <div className="hidden grid-cols-[minmax(320px,1.6fr)_minmax(180px,0.8fr)_150px_170px_120px] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:grid">
            <span>Talep</span>
            <span>Müşteri</span>
            <span>Durum</span>
            <span>Sorumlu</span>
            <span className="text-right">Son hareket</span>
          </div>

          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  referenceTime={referenceTime}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={InboxIcon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">
                Bu filtrelerle eşleşen talep yok
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

function TicketRow({
  ticket,
  referenceTime,
}: {
  ticket: AdminSupportTicketSummary
  referenceTime: number
}) {
  const status = ADMIN_SUPPORT_STATUS[ticket.status]
  const priority = ADMIN_SUPPORT_PRIORITY[ticket.priority]
  const isOverdue =
    !ticket.firstRespondedAt &&
    new Date(ticket.firstResponseDueAt).getTime() < referenceTime

  return (
    <Link
      href={APP_ROUTES.admin.supportTicket(ticket.id)}
      className="group grid gap-4 px-4 py-4 transition-colors hover:bg-muted/35 sm:px-5 xl:grid-cols-[minmax(320px,1.6fr)_minmax(180px,0.8fr)_150px_170px_120px] xl:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="font-semibold tracking-wide text-muted-foreground">
            {ticket.code}
          </span>
          <span className={cn("font-medium", priority.className)}>
            {priority.label}
          </span>
          {isOverdue ? (
            <span className="font-medium text-destructive">SLA aşıldı</span>
          ) : null}
          {ticket.lastMessage?.isInternal ? (
            <span className="text-amber-700 dark:text-amber-400">
              Dahili not
            </span>
          ) : null}
        </div>
        <h2 className="mt-1.5 truncate text-sm font-semibold">
          {ticket.subject}
        </h2>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {ticket.lastMessage?.body ?? "Henüz mesaj bulunmuyor."}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-medium">
          {ticket.createdBy?.name ?? "Silinmiş kullanıcı"}
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {ticket.workspace.name} · {ticket.store?.name ?? "Mağaza yok"}
        </p>
      </div>

      <div className="flex items-center gap-2 xl:block">
        <Badge
          variant="outline"
          className={cn("px-2 py-0.5 text-[10px]", status.className)}
        >
          {status.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground xl:mt-1.5 xl:block">
          {ticket.messageCount} mesaj
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {ticket.assignedAdmin ? getInitials(ticket.assignedAdmin.name) : "—"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {ticket.assignedAdmin?.name ?? "Atanmamış"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 xl:justify-end">
        <div className="xl:text-right">
          <p className="text-xs font-medium">
            {formatAdminSupportRelativeDate(ticket.updatedAt, referenceTime)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground xl:hidden">
            {formatAdminSupportDate(ticket.updatedAt)}
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

function SummaryMetric({
  label,
  value,
  helper,
  icon,
  attention = false,
  danger = false,
}: {
  label: string
  value: number
  helper: string
  icon: IconSvgElement
  attention?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0 sm:[&:nth-child(odd)]:border-r">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
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

function toSearchParams(query: AdminSupportTicketQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status) params.set("status", query.status)
  if (query.priority) params.set("priority", query.priority)
  if (query.category) params.set("category", query.category)
  if (query.assignee) params.set("assignee", query.assignee)
  if (query.sort && query.sort !== "LAST_ACTIVITY") {
    params.set("sort", query.sort)
  }
  if (query.page && query.page > 1) params.set("page", String(query.page))
  return params
}
