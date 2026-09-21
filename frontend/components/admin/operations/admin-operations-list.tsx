"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
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
import { retryAdminSyncRun } from "@/lib/api/admin-operations"
import { cn } from "@/lib/utils"
import type {
  AdminOperation,
  AdminOperationQueue,
  AdminOperationsPage,
  AdminOperationsQuery,
} from "@/types/admin-operations"
import type { IntegrationEnvironment } from "@/types/channel"
import type { SyncHistoryKind, SyncHistoryStatus } from "@/types/sync-history"
import { AdminOperationDetailDialog } from "./admin-operation-detail-dialog"
import {
  ADMIN_OPERATION_KINDS,
  ADMIN_OPERATION_STATUS,
  adminOperationKindLabel,
  adminOperationPrimaryMetric,
  adminOperationProviderLabel,
  adminOperationStageLabel,
  adminOperationTriggerLabel,
  formatAdminOperationDate,
  formatAdminOperationDuration,
  formatAdminOperationNumber,
} from "./admin-operations-presentation"

const ALL = "ALL"
const LIVE_REFRESH_MS = 5_000

export function AdminOperationsListView({
  data,
  query,
}: {
  data: AdminOperationsPage
  query: AdminOperationsQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [isNavigating, startTransition] = useTransition()
  const selectedRun =
    data.items.find((item) => item.id === selectedRunId) ?? null
  const hasLiveWork = data.summary.running > 0 || data.summary.queueBacklog > 0

  useEffect(() => {
    if (!hasLiveWork) return
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden" || retryingRunId) return
      startTransition(() => router.refresh())
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(intervalId)
  }, [hasLiveWork, retryingRunId, router])

  function navigate(changes: Partial<AdminOperationsQuery>) {
    const nextQuery: AdminOperationsQuery = {
      ...query,
      ...changes,
      page: changes.page ?? 1,
    }
    const params = toSearchParams(nextQuery)
    startTransition(() => {
      router.replace(
        params.size
          ? `${APP_ROUTES.admin.operations}?${params.toString()}`
          : APP_ROUTES.admin.operations
      )
    })
  }

  async function retryRun(run: AdminOperation) {
    if (!run.canRetry || retryingRunId) return
    setRetryingRunId(run.id)
    setFeedback(null)
    try {
      await retryAdminSyncRun(run.id)
      setSelectedRunId(null)
      setFeedback({
        type: "success",
        message: "Senkronizasyon güvenli biçimde yeniden kuyruğa alındı.",
      })
      startTransition(() => router.refresh())
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Senkronizasyon yeniden başlatılamadı.",
      })
    } finally {
      setRetryingRunId(null)
    }
  }

  const hasFilters = Boolean(
    query.q ||
    query.status ||
    query.kind ||
    query.provider ||
    query.environment ||
    query.issue ||
    query.period ||
    (query.order && query.order !== "NEWEST")
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Platform operasyonu
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Operasyonlar
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Senkronizasyonları, kanal sorunlarını ve worker kuyruklarını tek
            yerden izleyin.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hasLiveWork ? (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          ) : null}
          {hasLiveWork ? "Canlı yenileniyor" : "Son kontrol"} ·{" "}
          {formatAdminOperationDate(data.generatedAt)}
        </div>
      </div>

      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={cn(
            "mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs",
            feedback.type === "success"
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          )}
        >
          <HugeiconsIcon
            icon={
              feedback.type === "success"
                ? CheckmarkCircle01Icon
                : AlertCircleIcon
            }
            className="size-3.5"
          />
          {feedback.message}
        </div>
      ) : null}

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric
          label="Çalışan işlem"
          value={data.summary.running}
          helper="Şu anda devam eden"
          icon={RefreshIcon}
          tone={data.summary.running ? "positive" : "neutral"}
        />
        <SummaryMetric
          label="Son 24 saat hata"
          value={data.summary.failedLastDay}
          helper={`Başarı oranı ${data.summary.successRateLastDay === null ? "—" : `%${data.summary.successRateLastDay}`}`}
          icon={AlertCircleIcon}
          tone={data.summary.failedLastDay ? "danger" : "neutral"}
        />
        <SummaryMetric
          label="Takılmış işlem"
          value={data.summary.staleRunning}
          helper="Kilit süresini aşan"
          icon={Clock01Icon}
          tone={data.summary.staleRunning ? "attention" : "neutral"}
        />
        <SummaryMetric
          label="Kanal sorunu"
          value={data.summary.unhealthyConnections}
          helper="Kopuk veya hata durumunda"
          icon={AlertCircleIcon}
          tone={data.summary.unhealthyConnections ? "danger" : "neutral"}
        />
        <SummaryMetric
          label="Kuyruk yükü"
          value={data.summary.queueBacklog}
          helper="Bekleyen ve aktif işler"
          icon={RefreshIcon}
          tone={data.summary.queueBacklog ? "attention" : "neutral"}
        />
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Worker kuyrukları</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aktif yük ve son 24 saatte tamamlanamayan işler. Ayrıntı için bir
              kuyruğu seçin.
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {data.queues.length} kuyruk
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {data.queues.map((queue) => (
            <QueueCard key={queue.key} queue={queue} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Senkronizasyon geçmişi</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Katalog, stok ve soru toplama işlemleri. AI, cevap ve faturalama
            hataları yukarıdaki kuyruk ayrıntılarında gösterilir.
          </p>
        </div>
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
                placeholder="Mağaza, çalışma alanı, e-posta, sağlayıcı veya işlem kimliği ara..."
                aria-label="Operasyonlarda ara"
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
                options={Object.entries(ADMIN_OPERATION_STATUS).map(
                  ([value, item]) => ({ value, label: item.label })
                )}
                onValueChange={(value) =>
                  navigate({
                    status:
                      value === ALL ? undefined : (value as SyncHistoryStatus),
                  })
                }
              />
              <FilterSelect
                label="İşlem"
                value={query.kind ?? ALL}
                options={ADMIN_OPERATION_KINDS}
                onValueChange={(value) =>
                  navigate({
                    kind:
                      value === ALL ? undefined : (value as SyncHistoryKind),
                  })
                }
              />
              <FilterSelect
                label="Sağlayıcı"
                value={query.provider ?? ALL}
                options={data.providers.map((provider) => ({
                  value: provider,
                  label: adminOperationProviderLabel(provider),
                }))}
                onValueChange={(value) =>
                  navigate({ provider: value === ALL ? undefined : value })
                }
              />
              <FilterSelect
                label="Sorun"
                value={query.issue ?? ALL}
                options={[
                  { value: "STALE", label: "Takılmış işlem" },
                  { value: "CONNECTION", label: "Kanal sorunu" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    issue:
                      value === ALL
                        ? undefined
                        : (value as NonNullable<AdminOperationsQuery["issue"]>),
                  })
                }
              />
              <FilterSelect
                label="Dönem"
                value={query.period ?? ALL}
                options={[
                  { value: "24H", label: "Son 24 saat" },
                  { value: "7D", label: "Son 7 gün" },
                  { value: "30D", label: "Son 30 gün" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    period:
                      value === ALL
                        ? undefined
                        : (value as NonNullable<
                            AdminOperationsQuery["period"]
                          >),
                  })
                }
              />
              <FilterSelect
                label="Ortam"
                value={query.environment ?? ALL}
                options={[
                  { value: "PRODUCTION", label: "Canlı" },
                  { value: "SANDBOX", label: "Sandbox" },
                ]}
                onValueChange={(value) =>
                  navigate({
                    environment:
                      value === ALL
                        ? undefined
                        : (value as IntegrationEnvironment),
                  })
                }
              />
              <FilterSelect
                label="Sıralama"
                value={query.order ?? "NEWEST"}
                options={[
                  { value: "NEWEST", label: "En yeni" },
                  { value: "OLDEST", label: "En eski" },
                ]}
                includeAll={false}
                onValueChange={(value) =>
                  navigate({
                    order: value as NonNullable<AdminOperationsQuery["order"]>,
                  })
                }
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
              <p className="text-[11px] text-muted-foreground">
                {data.pagination.total} işlem filtreyle eşleşiyor.
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("")
                  startTransition(() =>
                    router.replace(APP_ROUTES.admin.operations)
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
          <div className="hidden grid-cols-[minmax(270px,1.2fr)_180px_190px_150px_180px] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:grid">
            <span>Hesap ve mağaza</span>
            <span>İşlem</span>
            <span>Durum</span>
            <span>Sonuç</span>
            <span className="text-right">Zaman</span>
          </div>

          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((run) => (
                <OperationRow
                  key={run.id}
                  run={run}
                  onSelect={() => setSelectedRunId(run.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={RefreshIcon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">İşlem bulunamadı</p>
              <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                Arama ifadesini veya filtreleri değiştirerek tekrar deneyin.
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

      <AdminOperationDetailDialog
        run={selectedRun}
        open={Boolean(selectedRun)}
        onOpenChange={(open) => {
          if (!open) setSelectedRunId(null)
        }}
        onRetry={() => {
          if (selectedRun) void retryRun(selectedRun)
        }}
        isRetrying={retryingRunId === selectedRun?.id}
      />
    </main>
  )
}

function OperationRow({
  run,
  onSelect,
}: {
  run: AdminOperation
  onSelect: () => void
}) {
  const status = ADMIN_OPERATION_STATUS[run.status]
  const primaryMetric = adminOperationPrimaryMetric(run)

  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none sm:px-5 xl:grid-cols-[minmax(270px,1.2fr)_180px_190px_150px_180px] xl:items-center"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{run.store.name}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {run.store.workspace.name} · {run.store.workspace.owner.email}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <ProviderLogo
          provider={run.connection.providerKey}
          className="size-8 shrink-0 rounded-lg shadow-none"
          sizes="32px"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">
            {adminOperationKindLabel(run.kind)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {adminOperationTriggerLabel(run.trigger)} ·{" "}
            {run.connection.environment === "SANDBOX" ? "Test" : "Canlı"}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("px-2 py-0 text-[9px]", status.className)}
          >
            {status.label}
          </Badge>
          {run.isStale ? (
            <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300">
              Takılmış olabilir
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
          {run.status === "RUNNING"
            ? `${adminOperationStageLabel(run.stage)} · %${run.progress}`
            : (run.connection.failureReason ??
              adminOperationStageLabel(run.stage))}
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold tabular-nums">
          {formatAdminOperationNumber(primaryMetric.value)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {primaryMetric.label} · {primaryMetric.helper}
        </p>
      </div>

      <div className="xl:text-right">
        <p className="text-xs font-medium">
          {formatAdminOperationDuration(run.durationMs)}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {formatAdminOperationDate(run.startedAt)}
        </p>
      </div>
    </button>
  )
}

function QueueCard({ queue }: { queue: AdminOperationQueue }) {
  const backlog = queue.counts.waiting + queue.counts.active
  const unhealthy = !queue.available || queue.paused || queue.counts.overdue > 0
  const hasRecentFailure = queue.recentFailuresLast24Hours > 0
  const retainedOldFailures = Math.max(
    0,
    queue.counts.failed - queue.recentFailuresLast24Hours
  )

  return (
    <Link
      href={APP_ROUTES.admin.operationQueue(queue.key)}
      className="group rounded-xl border border-border bg-card px-3 py-3 text-left shadow-xs transition-colors hover:border-primary/25 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-label={`${queue.label} kuyruğunun ayrıntılarını aç`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] leading-4 font-semibold">{queue.label}</p>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full bg-emerald-500",
              backlog > 0 && "bg-amber-500",
              (unhealthy || hasRecentFailure) && "bg-destructive"
            )}
          />
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold tabular-nums">{backlog}</p>
          <p className="text-[9px] text-muted-foreground">aktif yük</p>
        </div>
        <div className="text-right text-[9px] leading-4 text-muted-foreground">
          <p>{queue.counts.active} çalışıyor</p>
          <p>{queue.counts.scheduled} zamanlandı</p>
          {queue.counts.overdue > 0 ? (
            <p className="font-medium text-destructive">
              {queue.counts.overdue} süre aştı
            </p>
          ) : null}
          <p className={cn(hasRecentFailure && "font-medium text-destructive")}>
            Son 24 saat: {queue.recentFailuresLast24Hours} hata
          </p>
        </div>
      </div>
      {retainedOldFailures > 0 ? (
        <p className="mt-2 border-t border-border/70 pt-2 text-[9px] text-muted-foreground">
          Redis’te {retainedOldFailures} geçmiş hata kaydı
        </p>
      ) : null}
      {!queue.available || queue.paused ? (
        <p className="mt-2 border-t border-border pt-2 text-[9px] font-medium text-destructive">
          {!queue.available ? "Redis bağlantısı yok" : "Kuyruk duraklatıldı"}
        </p>
      ) : null}
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
      <SelectTrigger size="sm" className="min-w-34 bg-background">
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

function toSearchParams(query: AdminOperationsQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  if (params.get("page") === "1") params.delete("page")
  if (params.get("pageSize") === "25") params.delete("pageSize")
  if (params.get("order") === "NEWEST") params.delete("order")
  return params
}
