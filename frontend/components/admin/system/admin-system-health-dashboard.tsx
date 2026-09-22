import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  CreditCardIcon,
  Database01Icon,
  Link01Icon,
  RefreshIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type {
  AdminHealthStatus,
  AdminSystemHealth,
  AdminSystemQueue,
} from "@/types/admin-system-health"

const numberFormatter = new Intl.NumberFormat("tr-TR")

export function AdminSystemHealthDashboard({
  data,
}: {
  data: AdminSystemHealth
}) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Altyapı görünürlüğü
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Sistem sağlığı
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Veri tabanı, kuyruklar, ödeme hattı ve pazaryeri bağlantıları.
          </p>
        </div>
        <Link
          href={APP_ROUTES.admin.system}
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-xl border border-border bg-card px-3 text-xs font-medium shadow-xs transition-colors hover:bg-muted sm:self-auto"
        >
          <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
          Yenile
        </Link>
      </div>

      <OverallStatus status={data.status} generatedAt={data.generatedAt} />

      <section className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kuyrukta bekleyen"
          value={data.summary.queueBacklog}
          helper={`${data.summary.backloggedQueues} yoğun · ${data.summary.queuesWithStuckWaitingJobs + data.summary.queuesWithLongRunningJobs} takılmış · ${data.summary.queuesWithoutWorkers} workersız`}
          icon={Clock01Icon}
          alert={
            data.summary.unavailableQueues > 0 ||
            data.summary.pausedQueues > 0 ||
            data.summary.backloggedQueues > 0 ||
            data.summary.queuesWithoutWorkers > 0 ||
            data.summary.queuesWithStuckWaitingJobs > 0 ||
            data.summary.queuesWithLongRunningJobs > 0 ||
            data.summary.queuesWithRecentFailures > 0
          }
        />
        <MetricCard
          label="Pazaryeri sorunu"
          value={data.summary.connectionIssues}
          helper="Bağlantısı kopmuş veya hata veren kanallar"
          icon={Link01Icon}
          alert={data.summary.connectionIssues > 0}
        />
        <MetricCard
          label="Ödeme hattı sorunu"
          value={data.summary.billingIssues}
          helper="Webhook ve geciken reconciliation toplamı"
          icon={CreditCardIcon}
          alert={data.summary.billingIssues > 0}
        />
        <MetricCard
          label="Son 24 saat işlem"
          value={data.syncs.completedLast24Hours}
          helper={`${data.syncs.failedLast24Hours} başarısız · ${data.syncs.running} çalışıyor`}
          icon={RefreshIcon}
          alert={data.syncs.failedLast24Hours > 0}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-3">
        <ServiceCard
          label="API"
          description="Admin sağlık endpointi"
          status={data.services.api.status}
          icon={Settings02Icon}
        />
        <ServiceCard
          label="PostgreSQL"
          description={latencyLabel(data.services.database.latencyMs)}
          status={data.services.database.status}
          errorCode={data.services.database.errorCode}
          icon={Database01Icon}
        />
        <ServiceCard
          label="Redis"
          description={latencyLabel(data.services.redis.latencyMs)}
          status={data.services.redis.status}
          errorCode={data.services.redis.errorCode}
          icon={RefreshIcon}
        />
      </section>

      <section className="mt-5">
        <Panel
          title="Kuyruklar"
          description="Worker canlılığı, iş süreleri ve Redis’te saklanan son 24 saat hataları"
          href={APP_ROUTES.admin.operations}
        >
          <QueueTable queues={data.queues} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel
          title="Paddle işleme hattı"
          description="Webhook teslimatı ve abonelik uzlaştırması"
          href={APP_ROUTES.admin.billing}
        >
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <SmallValue
              label="24 saatte webhook"
              value={data.billing.webhookEventsLast24Hours}
            />
            <SmallValue
              label="Webhook hatası"
              value={data.billing.webhookFailuresLast24Hours}
              alert={data.billing.webhookFailuresLast24Hours > 0}
            />
            <SmallValue
              label="Geciken kontrol"
              value={data.billing.overdueReconciliations}
              alert={data.billing.overdueReconciliations > 0}
            />
            <SmallValue
              label="Kontrol hatası"
              value={data.billing.reconciliationFailures}
              alert={data.billing.reconciliationFailures > 0}
            />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 text-xs">
            <span className="text-muted-foreground">Son işlenen webhook</span>
            <span className="text-right font-medium">
              {data.billing.lastWebhook
                ? `${data.billing.lastWebhook.eventType} · ${formatDate(data.billing.lastWebhook.processedAt)}`
                : "Henüz kayıt yok"}
            </span>
          </div>
          <BillingIssueList
            issues={data.billing.reconciliationIssues}
            generatedAt={data.generatedAt}
          />
        </Panel>

        <Panel
          title="Pazaryeri bağlantıları"
          description="Aktif bağlantıların sağlayıcı bazında durumu"
          href={APP_ROUTES.admin.operations}
        >
          {data.marketplaces.providers.length ? (
            <div className="divide-y divide-border">
              {data.marketplaces.providers.map((provider) => (
                <div
                  key={provider.providerKey}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      provider.issues
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/8 text-primary"
                    )}
                  >
                    <HugeiconsIcon icon={Link01Icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {providerLabel(provider.providerKey)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {provider.connected} bağlı · {provider.pending} bekliyor
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      provider.issues
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {provider.issues
                      ? `${provider.issues} sorun`
                      : `${provider.total} sağlıklı`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Kayıtlı pazaryeri bağlantısı yok." />
          )}
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel
          title="Bağlantı sorunları"
          description="İşlem gerektiren mağaza ve pazaryeri bağlantıları"
          href={APP_ROUTES.admin.operations}
        >
          {data.marketplaces.issues.length ? (
            <div className="divide-y divide-border">
              {data.marketplaces.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={APP_ROUTES.admin.operations}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {issue.store.name} · {providerLabel(issue.providerKey)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {issue.failureReason ?? "Bağlantı kullanılamıyor"}
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="İşlem gerektiren bağlantı sorunu yok." />
          )}
        </Panel>

        <Panel
          title="Son kritik hatalar"
          description="Son 24 saatte audit sistemine düşen hatalar"
          href={`${APP_ROUTES.admin.auditLogs}?result=FAILURE&period=24H`}
        >
          {data.recentErrors.length ? (
            <div className="divide-y divide-border">
              {data.recentErrors.map((error) => (
                <div key={error.id} className="flex gap-3 px-5 py-3.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {actionLabel(error.action)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {originLabel(error.origin)} ·{" "}
                      {formatDate(error.createdAt)}
                    </p>
                  </div>
                  {error.errorCode ? (
                    <code className="hidden max-w-40 self-center truncate text-[10px] text-destructive sm:block">
                      {error.errorCode}
                    </code>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Son 24 saatte kritik hata kaydedilmedi." />
          )}
        </Panel>
      </section>
    </main>
  )
}

function OverallStatus({
  status,
  generatedAt,
}: {
  status: AdminHealthStatus
  generatedAt: string
}) {
  const content = {
    HEALTHY: {
      title: "Tüm temel sistemler çalışıyor",
      detail: "Veri tabanı, Redis ve kuyruklara erişim sağlıklı.",
      icon: CheckmarkCircle01Icon,
      className:
        "border-emerald-500/20 bg-emerald-500/6 text-emerald-700 dark:text-emerald-300",
    },
    DEGRADED: {
      title: "Bazı operasyonlar dikkat gerektiriyor",
      detail: "Temel servisler çalışıyor ancak işlem gerektiren sinyaller var.",
      icon: AlertCircleIcon,
      className:
        "border-amber-500/20 bg-amber-500/6 text-amber-700 dark:text-amber-300",
    },
    DOWN: {
      title: "Temel servislerden birine erişilemiyor",
      detail:
        "PostgreSQL, Redis veya erişilemeyen kuyrukları hemen kontrol edin.",
      icon: AlertCircleIcon,
      className: "border-destructive/20 bg-destructive/6 text-destructive",
    },
  }[status]
  return (
    <div
      className={cn(
        "mt-7 flex flex-col justify-between gap-4 rounded-xl border px-5 py-4 sm:flex-row sm:items-center",
        content.className
      )}
    >
      <div className="flex items-center gap-3">
        <HugeiconsIcon icon={content.icon} className="size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{content.title}</p>
          <p className="mt-1 text-xs opacity-80">{content.detail}</p>
        </div>
      </div>
      <p className="shrink-0 text-[11px] opacity-75">
        Kontrol · {formatDate(generatedAt)}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  alert,
}: {
  label: string
  value: number
  helper: string
  icon: IconSvgElement
  alert: boolean
}) {
  return (
    <div className="flex min-h-36 flex-col bg-card p-5">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          alert
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/8 text-primary"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4.5" />
      </span>
      <div className="mt-auto pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums",
            alert && "text-destructive"
          )}
        >
          {formatNumber(value)}
        </p>
        <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
          {helper}
        </p>
      </div>
    </div>
  )
}

function ServiceCard({
  label,
  description,
  status,
  errorCode,
  icon,
}: {
  label: string
  description: string
  status: AdminHealthStatus
  errorCode?: string | null
  icon: IconSvgElement
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          status === "HEALTHY" &&
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          status === "DEGRADED" &&
            "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          status === "DOWN" && "bg-destructive/10 text-destructive"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{label}</p>
          <StatusLabel status={status} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {errorCode ?? description}
        </p>
      </div>
    </div>
  )
}

function StatusLabel({ status }: { status: AdminHealthStatus }) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium",
        status === "HEALTHY" && "text-emerald-600 dark:text-emerald-400",
        status === "DEGRADED" && "text-amber-600 dark:text-amber-400",
        status === "DOWN" && "text-destructive"
      )}
    >
      {status === "HEALTHY"
        ? "Sağlıklı"
        : status === "DEGRADED"
          ? "Kısmi"
          : "Erişilemiyor"}
    </span>
  )
}

function Panel({
  title,
  description,
  href,
  children,
}: {
  title: string
  description: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            İncele
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function QueueTable({ queues }: { queues: AdminSystemQueue[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[minmax(240px,1fr)_80px_repeat(5,100px)_120px] border-b border-border bg-muted/35 px-5 py-2.5 text-[11px] font-medium text-muted-foreground">
          <span>Kuyruk</span>
          <span className="text-right">Worker</span>
          <span className="text-right">Bekleyen</span>
          <span className="text-right">Çalışan</span>
          <span className="text-right">Zamanlanmış</span>
          <span className="text-right">Süresi aşan</span>
          <span className="text-right">24 sa. hata</span>
          <span className="text-right">Durum</span>
        </div>
        {queues.map((queue) => (
          <Link
            key={queue.key}
            href={APP_ROUTES.admin.operationQueue(queue.key)}
            className="grid grid-cols-[minmax(240px,1fr)_80px_repeat(5,100px)_120px] items-center border-b border-border px-5 py-3.5 text-xs transition-colors last:border-b-0 hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none"
          >
            <div className="min-w-0">
              <p className="font-medium">{queue.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Uyarı eşiği: {formatNumber(queue.backlogWarningThreshold)}
              </p>
              {queue.oldestWaitingAgeMs !== null ||
              queue.longestActiveAgeMs !== null ? (
                <p
                  className={cn(
                    "mt-0.5 text-[10px] text-muted-foreground",
                    (queue.waitingAgeExceeded ||
                      queue.activeDurationExceeded) &&
                      "font-medium text-destructive"
                  )}
                >
                  {queue.oldestWaitingAgeMs !== null
                    ? `En eski bekleme ${formatRuntimeAge(queue.oldestWaitingAgeMs)}`
                    : null}
                  {queue.oldestWaitingAgeMs !== null &&
                  queue.longestActiveAgeMs !== null
                    ? " · "
                    : null}
                  {queue.longestActiveAgeMs !== null
                    ? `En uzun çalışma ${formatRuntimeAge(queue.longestActiveAgeMs)}`
                    : null}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "text-right tabular-nums",
                queue.workerUnavailable && "font-medium text-destructive"
              )}
            >
              {queue.workerCount === null
                ? "—"
                : formatNumber(queue.workerCount)}
            </span>
            <QueueNumber value={queue.counts.waiting} />
            <QueueNumber value={queue.counts.active} />
            <QueueNumber value={queue.counts.scheduled} />
            <QueueNumber value={queue.counts.overdue} alert />
            <QueueNumber value={queue.recentFailuresLast24Hours} alert />
            <span
              className={cn(
                "text-right font-medium",
                queue.status === "HEALTHY" &&
                  "text-emerald-600 dark:text-emerald-400",
                queue.status === "DEGRADED" &&
                  "text-amber-600 dark:text-amber-400",
                queue.status === "DOWN" && "text-destructive"
              )}
            >
              {!queue.available
                ? "Erişilemiyor"
                : queue.paused
                  ? "Duraklatıldı"
                  : queue.workerUnavailable
                    ? "Worker yok"
                    : queue.waitingAgeExceeded
                      ? "Bekleme takıldı"
                      : queue.activeDurationExceeded
                        ? "İşlem takıldı"
                  : queue.backlogExceeded
                    ? "Yoğun"
                    : queue.counts.overdue > 0
                      ? "Süre aştı"
                      : queue.recentFailuresLast24Hours > 0
                        ? "Hata var"
                        : "Aktif"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function QueueNumber({
  value,
  alert = false,
}: {
  value: number
  alert?: boolean
}) {
  return (
    <span
      className={cn(
        "text-right tabular-nums",
        alert && value > 0 && "text-destructive"
      )}
    >
      {formatNumber(value)}
    </span>
  )
}

function SmallValue({
  label,
  value,
  alert = false,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="bg-card p-4">
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          alert && "text-destructive"
        )}
      >
        {formatNumber(value)}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function BillingIssueList({
  issues,
  generatedAt,
}: {
  issues: AdminSystemHealth["billing"]["reconciliationIssues"]
  generatedAt: string
}) {
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 border-t border-border px-5 py-4 text-xs text-muted-foreground">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="size-4 text-emerald-600 dark:text-emerald-400"
        />
        İşlem gerektiren abonelik kontrolü yok.
      </div>
    )
  }

  return (
    <div className="border-t border-border">
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-medium">İşlem gerektiren abonelikler</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Geciken veya son kontrolünde hata alınan müşteriler
        </p>
      </div>
      <div className="divide-y divide-border">
        {issues.map((issue) => (
          <Link
            key={issue.id}
            href={APP_ROUTES.admin.billingWorkspace(issue.workspaceId)}
            className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                issue.issueTypes.includes("FAILED")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              )}
            >
              <HugeiconsIcon
                icon={
                  issue.issueTypes.includes("FAILED")
                    ? AlertCircleIcon
                    : Clock01Icon
                }
                className="size-4"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-xs font-medium">
                  {issue.owner.name}
                </p>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {billingPlanLabel(issue.plan)}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {issue.owner.email} · {billingIssueSummary(issue, generatedAt)}
              </p>
              {issue.reconcileErrorCode ? (
                <code className="mt-1 block truncate text-[10px] text-destructive">
                  {issue.reconcileErrorCode}
                </code>
              ) : null}
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
      </span>
      <p className="mt-3 text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

function latencyLabel(value: number | null) {
  return value === null ? "Gecikme ölçülemedi" : `${value} ms yanıt süresi`
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function billingIssueSummary(
  issue: AdminSystemHealth["billing"]["reconciliationIssues"][number],
  generatedAt: string
) {
  const parts: string[] = []
  if (issue.issueTypes.includes("OVERDUE")) {
    const minutes = Math.max(
      1,
      Math.floor(
        (new Date(generatedAt).getTime() -
          new Date(issue.reconcileAfter).getTime()) /
          60_000
      )
    )
    parts.push(`${formatDuration(minutes)} gecikti`)
  }
  if (issue.issueTypes.includes("FAILED")) {
    parts.push(`${formatNumber(issue.reconcileFailures)} başarısız kontrol`)
  }
  return parts.join(" · ")
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} sa ${remainder} dk` : `${hours} sa`
}

function formatRuntimeAge(valueMs: number) {
  if (valueMs < 60_000) return "1 dk altı"
  return formatDuration(Math.ceil(valueMs / 60_000))
}

function billingPlanLabel(value: "STARTER" | "GROWTH" | "BUSINESS") {
  return (
    {
      STARTER: "Starter",
      GROWTH: "Growth",
      BUSINESS: "Business",
    }[value] ?? value
  )
}

function providerLabel(value: string) {
  if (value === "trendyol") return "Trendyol"
  if (value === "hepsiburada") return "Hepsiburada"
  return value
}

function originLabel(value: string) {
  return (
    {
      API: "API",
      WORKER: "Worker",
      WEBHOOK: "Webhook",
      SCHEDULED: "Zamanlanmış işlem",
      SYSTEM: "Sistem",
    }[value] ?? value
  )
}

function actionLabel(value: string) {
  return (
    {
      BILLING_WEBHOOK_FAILED: "Paddle webhook'u işlenemedi",
      CATALOG_SYNC_FAILED: "Katalog senkronizasyonu başarısız",
      QUESTION_SYNC_FAILED: "Soru senkronizasyonu başarısız",
      ADMIN_SYNC_RETRY: "Senkronizasyon yeniden denenemedi",
      ADMIN_BILLING_RECONCILE: "Abonelik uzlaştırılamadı",
    }[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("tr-TR")
  )
}
