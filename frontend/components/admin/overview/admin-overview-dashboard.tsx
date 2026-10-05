import Link from "next/link"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
  Clock01Icon,
  CreditCardIcon,
  CustomerSupportIcon,
  RefreshIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type { AdminOverview } from "@/types/admin-overview"
import { AdminSubscriptionDistributionChart } from "./admin-subscription-distribution-chart"

const numberFormatter = new Intl.NumberFormat("tr-TR")

export function AdminOverviewDashboard({ data }: { data: AdminOverview }) {
  const { metrics } = data
  const attentionCount =
    metrics.subscriptions.pastDue +
    metrics.support.overdueFirstResponse +
    metrics.operations.failedLast24Hours +
    metrics.operations.stale +
    metrics.audit.failuresLast24Hours

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Operasyon merkezi
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Genel bakış
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Müşteri, ödeme ve sistem operasyonlarının güncel durumu.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Son güncelleme · {formatDate(data.generatedAt)}
        </p>
      </div>

      <section className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          href={APP_ROUTES.admin.customers}
          label="Çalışma alanları"
          value={metrics.customers.totalWorkspaces}
          helper={`${formatNumber(metrics.customers.activeStores)} aktif mağaza · son 30 günde +${formatNumber(metrics.customers.newWorkspacesLast30Days)}`}
          icon={UserGroupIcon}
        />
        <MetricCard
          href={APP_ROUTES.admin.billing}
          label="Aktif abonelikler"
          value={metrics.subscriptions.active}
          helper={`${formatNumber(metrics.subscriptions.trialing)} deneme · ${formatNumber(metrics.subscriptions.total)} toplam`}
          icon={CreditCardIcon}
        />
        <MetricCard
          href={APP_ROUTES.admin.aiUsage}
          label="AI soru kullanımı"
          value={metrics.aiUsage.last30Days}
          helper={aiUsageComparison(metrics.aiUsage.changePercentage)}
          icon={AiSparklesIcon}
        />
        <MetricCard
          href={APP_ROUTES.admin.auditLogs}
          label="Dikkat gereken"
          value={attentionCount}
          helper="Ödeme, destek, senkronizasyon ve sistem olayları"
          icon={AlertCircleIcon}
          tone={attentionCount > 0 ? "danger" : "neutral"}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Abonelik dağılımı"
          description="Tüm çalışma alanlarının güncel abonelik durumu"
          href={APP_ROUTES.admin.billing}
        >
          <AdminSubscriptionDistributionChart metrics={metrics.subscriptions} />
        </Panel>

        <Panel
          title="Operasyon durumu"
          description="Şu anda müdahale gerektirebilecek alanlar"
        >
          <div className="divide-y divide-border">
            <OperationRow
              href={APP_ROUTES.admin.support}
              icon={CustomerSupportIcon}
              label="Destek talepleri"
              value={metrics.support.open}
              detail={`${formatNumber(metrics.support.highPriority)} yüksek öncelik · ${formatNumber(metrics.support.overdueFirstResponse)} SLA gecikmesi`}
              alert={metrics.support.overdueFirstResponse > 0}
            />
            <OperationRow
              href={APP_ROUTES.admin.billing}
              icon={CreditCardIcon}
              label="Ödeme sorunları"
              value={metrics.subscriptions.pastDue}
              detail="Tahsilat veya ödeme kontrolü bekleyen hesaplar"
              alert={metrics.subscriptions.pastDue > 0}
            />
            <OperationRow
              href={APP_ROUTES.admin.operations}
              icon={RefreshIcon}
              label="Senkronizasyonlar"
              value={metrics.operations.running}
              detail={`${formatNumber(metrics.operations.failedLast24Hours)} hata · ${formatNumber(metrics.operations.stale)} takılmış işlem`}
              alert={
                metrics.operations.failedLast24Hours > 0 ||
                metrics.operations.stale > 0
              }
            />
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Öncelikli destek kuyruğu"
          description="Yanıt veya işlem bekleyen en önemli talepler"
          href={APP_ROUTES.admin.support}
        >
          {data.attention.supportTickets.length ? (
            <div className="divide-y divide-border">
              {data.attention.supportTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={APP_ROUTES.admin.supportTicket(ticket.id)}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      ticket.isFirstResponseOverdue
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/8 text-primary"
                    )}
                  >
                    <HugeiconsIcon
                      icon={
                        ticket.isFirstResponseOverdue
                          ? Clock01Icon
                          : CustomerSupportIcon
                      }
                      className="size-4"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        #{ticket.number} · {ticket.subject}
                      </p>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {ticket.workspace.name} · {supportStatus(ticket.status)} ·{" "}
                      {relativeTime(ticket.lastMessageAt)}
                    </p>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="Yanıt bekleyen destek talebi yok." />
          )}
        </Panel>

        <Panel
          title="Ödeme sorunu yaşayan hesaplar"
          description="Gecikmiş durumdaki abonelikler"
          href={APP_ROUTES.admin.billing}
        >
          {data.attention.paymentIssues.length ? (
            <div className="divide-y divide-border">
              {data.attention.paymentIssues.map((issue) => (
                <Link
                  key={issue.workspaceId}
                  href={APP_ROUTES.admin.billingWorkspace(issue.workspaceId)}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <HugeiconsIcon icon={CreditCardIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {issue.workspaceName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {issue.ownerEmail} · {planLabel(issue.plan)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-destructive">
                      Ödeme gecikmiş
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDay(issue.currentPeriodEnd)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="Ödeme sorunu yaşayan hesap yok." />
          )}
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Son önemli olaylar"
          description="Kritik sistem ve yönetici işlemleri"
          href={APP_ROUTES.admin.auditLogs}
        >
          {data.recentAuditEvents.length ? (
            <div className="divide-y divide-border">
              {data.recentAuditEvents.map((event) => (
                <div key={event.id} className="flex gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      event.result === "FAILURE"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/8 text-primary"
                    )}
                  >
                    <HugeiconsIcon
                      icon={
                        event.result === "FAILURE"
                          ? AlertCircleIcon
                          : ShieldCheckIcon
                      }
                      className="size-4"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium">
                        {auditActionLabel(event.action)}
                      </p>
                      {event.result === "FAILURE" ? (
                        <Badge className="border-destructive/20 bg-destructive/8 px-2 py-0 text-[10px] text-destructive">
                          Başarısız
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {event.actor?.name ?? actorLabel(event.actorType)}
                      {event.workspace
                        ? ` · ${event.workspace.name}`
                        : ""} · {relativeTime(event.createdAt)}
                    </p>
                  </div>
                  {event.errorCode ? (
                    <code className="hidden max-w-44 self-center truncate text-[10px] text-destructive sm:block">
                      {event.errorCode}
                    </code>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Henüz önemli bir denetim olayı yok." />
          )}
        </Panel>

        <Panel
          title="Son senkronizasyon hataları"
          description="Son 24 saatte başarısız olan işlemler"
          href={APP_ROUTES.admin.operations}
        >
          {data.attention.failedSyncs.length ? (
            <div className="divide-y divide-border">
              {data.attention.failedSyncs.map((sync) => (
                <Link
                  key={sync.id}
                  href={APP_ROUTES.admin.operations}
                  className="group flex gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {sync.store.name} · {syncKindLabel(sync.kind)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {providerLabel(sync.providerKey)} ·{" "}
                      {sync.completedAt
                        ? relativeTime(sync.completedAt)
                        : "Tamamlanma zamanı yok"}
                    </p>
                    {sync.errorMessage ? (
                      <p className="mt-1.5 line-clamp-1 text-[11px] text-destructive/85">
                        {sync.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState text="Son 24 saatte senkronizasyon hatası yok." />
          )}
        </Panel>
      </section>
    </main>
  )
}

function MetricCard({
  href,
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  href: string
  label: string
  value: number
  helper: string
  icon: IconSvgElement
  tone?: "neutral" | "danger"
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-36 flex-col bg-card p-5 transition-colors hover:bg-muted/45"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/8 text-primary"
          )}
        >
          <HugeiconsIcon icon={icon} className="size-4.5" />
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <div className="mt-auto pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] tabular-nums">
          {formatNumber(value)}
        </p>
        <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
          {helper}
        </p>
      </div>
    </Link>
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
            Tümünü gör
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function OperationRow({
  href,
  icon,
  label,
  value,
  detail,
  alert,
}: {
  href: string
  icon: IconSvgElement
  label: string
  value: number
  detail: string
  alert: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/45"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          alert
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/8 text-primary"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {detail}
        </p>
      </div>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          alert && "text-destructive"
        )}
      >
        {formatNumber(value)}
      </p>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function PriorityBadge({
  priority,
}: {
  priority: "NORMAL" | "HIGH" | "URGENT"
}) {
  if (priority === "NORMAL") return null
  return (
    <Badge
      className={cn(
        "shrink-0 px-2 py-0 text-[10px]",
        priority === "URGENT"
          ? "border-destructive/20 bg-destructive/8 text-destructive"
          : "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300"
      )}
    >
      {priority === "URGENT" ? "Acil" : "Yüksek"}
    </Badge>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-5 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/8 text-primary">
        <HugeiconsIcon icon={ShieldCheckIcon} className="size-4" />
      </span>
      <p className="mt-3 text-xs text-muted-foreground">{text}</p>
    </div>
  )
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

function formatDay(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function relativeTime(value: string) {
  const difference = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(difference)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ]
  const [unit, size] = units.find(([, size]) => absolute >= size) ?? [
    "minute" as const,
    60 * 1000,
  ]
  return new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" }).format(
    Math.round(difference / size),
    unit
  )
}

function aiUsageComparison(change: number | null) {
  if (change === null) return "Önceki dönemde kullanım yoktu"
  if (change === 0) return "Önceki 30 günle aynı seviyede"
  return `Önceki 30 güne göre %${Math.abs(change)} ${change > 0 ? "artış" : "azalış"}`
}

function planLabel(plan: "STARTER" | "GROWTH" | "BUSINESS") {
  return plan.charAt(0) + plan.slice(1).toLocaleLowerCase("tr-TR")
}

function supportStatus(status: string) {
  return (
    {
      OPEN: "Açık",
      IN_PROGRESS: "İşlemde",
      WAITING_CUSTOMER: "Müşteri bekleniyor",
      RESOLVED: "Çözüldü",
      CLOSED: "Kapalı",
    }[status] ?? status
  )
}

function syncKindLabel(kind: "FULL" | "INVENTORY" | "QUESTION") {
  return {
    FULL: "Katalog",
    INVENTORY: "Stok",
    QUESTION: "Soru",
  }[kind]
}

function providerLabel(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}

function actorLabel(actorType: "USER" | "ADMIN" | "SYSTEM") {
  return { USER: "Kullanıcı", ADMIN: "Yönetici", SYSTEM: "Sistem" }[actorType]
}

function auditActionLabel(action: string) {
  return (
    {
      ADMIN_SIGNED_IN: "Yönetici oturum açtı",
      ADMIN_AUTH_PROVIDER_LINKED: "Giriş sağlayıcısı bağlandı",
      ADMIN_AUTH_PROVIDER_UNLINKED: "Giriş sağlayıcısı kaldırıldı",
      ADMIN_OTHER_SESSION_REVOKED: "Diğer cihazdaki oturum sonlandırıldı",
      ADMIN_PROFILE_UPDATED: "Yönetici profili güncellendi",
      ADMIN_BILLING_RECONCILE: "Abonelik yeniden uzlaştırıldı",
      ADMIN_SYNC_RETRY: "Senkronizasyon tekrarlandı",
      ADMIN_SUPPORT_REPLY_ADDED: "Destek yanıtı eklendi",
      ADMIN_SUPPORT_INTERNAL_NOTE_ADDED: "Destek iç notu eklendi",
      ADMIN_SUPPORT_STATUS_CHANGED: "Destek durumu değiştirildi",
      ADMIN_SUPPORT_ASSIGNEE_CHANGED: "Destek sorumlusu değiştirildi",
      ADMIN_CONTACT_MESSAGE_STATUS_CHANGED:
        "İletişim mesajı durumu değiştirildi",
      ADMIN_ANNOUNCEMENT_PUBLISHED: "Toplu duyuru yayımlandı",
      BILLING_PLAN_CHANGE_CONFIRMED: "Plan değişikliği onaylandı",
      BILLING_SUBSCRIPTION_CANCEL_REQUESTED: "Abonelik iptali planlandı",
      BILLING_CANCELLATION_REVERSED: "Planlanan abonelik iptali geri alındı",
      BILLING_SUBSCRIPTION_SYNCHRONIZED: "Abonelik durumu eşitlendi",
      BILLING_TRANSACTION_RECOVERED: "Ödeme bağlantısı kurtarıldı",
      BILLING_WEBHOOK_FAILED: "Ödeme webhook'u işlenemedi",
      CATALOG_SYNC_FAILED: "Katalog senkronizasyonu başarısız",
      QUESTION_SYNC_FAILED: "Soru senkronizasyonu başarısız",
      ACCOUNT_BILLING_CLOSED: "Hesap ödemeleri kapatıldı",
      ACCOUNT_DELETED: "Kullanıcı hesabı silindi",
    }[action] ?? action.replaceAll("_", " ").toLocaleLowerCase("tr-TR")
  )
}
