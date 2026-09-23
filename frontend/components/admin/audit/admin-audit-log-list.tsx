"use client"

import { useState, useTransition } from "react"
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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type {
  AdminAuditLog,
  AdminAuditLogsPage,
  AdminAuditLogsQuery,
  AuditActorType,
  AuditOrigin,
  AuditResult,
} from "@/types/admin-audit"

const ALL = "ALL"

export function AdminAuditLogList({
  data,
  query,
}: {
  data: AdminAuditLogsPage
  query: AdminAuditLogsQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNavigating, startTransition] = useTransition()
  const selected = data.items.find((item) => item.id === selectedId) ?? null

  function navigate(changes: Partial<AdminAuditLogsQuery>) {
    const nextQuery = {
      ...query,
      ...changes,
      page: changes.page ?? 1,
    }
    const params = toSearchParams(nextQuery)
    startTransition(() => {
      router.replace(
        params.size
          ? `${APP_ROUTES.admin.auditLogs}?${params.toString()}`
          : APP_ROUTES.admin.auditLogs
      )
    })
  }

  const hasFilters = Boolean(
    query.q ||
    query.actorType ||
    query.origin ||
    query.result ||
    query.action ||
    query.period ||
    (query.order && query.order !== "NEWEST")
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Güvenlik ve izlenebilirlik
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Denetim kayıtları
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kritik kullanıcı, yönetici ve sistem işlemlerinin değiştirilemeyen
            geçmişini inceleyin.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Son güncelleme · {formatDate(data.generatedAt)}
        </p>
      </div>

      <section className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Toplam kayıt"
          value={data.summary.total}
          helper="Saklanan tüm olaylar"
          icon={RefreshIcon}
        />
        <SummaryMetric
          label="Son 24 saat"
          value={data.summary.last24Hours}
          helper="Yeni denetim kaydı"
          icon={Clock01Icon}
        />
        <SummaryMetric
          label="Başarısız işlem"
          value={data.summary.failuresLast24Hours}
          helper="Son 24 saatte"
          icon={AlertCircleIcon}
          tone={data.summary.failuresLast24Hours ? "danger" : "neutral"}
        />
        <SummaryMetric
          label="Yönetici işlemi"
          value={data.summary.adminActionsLast24Hours}
          helper="Son 24 saatte"
          icon={CheckmarkCircle01Icon}
        />
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-3 shadow-xs">
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
              placeholder="İşlem, kayıt, request veya hata kodu ara..."
              aria-label="Denetim kayıtlarında ara"
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
              label="Sonuç"
              value={query.result ?? ALL}
              options={[
                { value: "SUCCESS", label: "Başarılı" },
                { value: "FAILURE", label: "Başarısız" },
                { value: "STARTED", label: "Başlatıldı" },
              ]}
              onValueChange={(value) =>
                navigate({
                  result: value === ALL ? undefined : (value as AuditResult),
                })
              }
            />
            <FilterSelect
              label="Aktör"
              value={query.actorType ?? ALL}
              options={[
                { value: "ADMIN", label: "Yönetici" },
                { value: "USER", label: "Kullanıcı" },
                { value: "SYSTEM", label: "Sistem" },
              ]}
              onValueChange={(value) =>
                navigate({
                  actorType:
                    value === ALL ? undefined : (value as AuditActorType),
                })
              }
            />
            <FilterSelect
              label="Kaynak"
              value={query.origin ?? ALL}
              options={[
                { value: "API", label: "API" },
                { value: "WORKER", label: "Worker" },
                { value: "WEBHOOK", label: "Webhook" },
                { value: "SCHEDULED", label: "Zamanlanmış" },
                { value: "SYSTEM", label: "Sistem" },
              ]}
              onValueChange={(value) =>
                navigate({
                  origin: value === ALL ? undefined : (value as AuditOrigin),
                })
              }
            />
            <FilterSelect
              label="İşlem"
              value={query.action ?? ALL}
              options={data.actions.map((action) => ({
                value: action,
                label: actionLabel(action),
              }))}
              onValueChange={(value) =>
                navigate({ action: value === ALL ? undefined : value })
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
                      : (value as NonNullable<AdminAuditLogsQuery["period"]>),
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
                  order: value as NonNullable<AdminAuditLogsQuery["order"]>,
                })
              }
            />
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
            <p className="text-[11px] text-muted-foreground">
              {data.pagination.total.toLocaleString("tr-TR")} kayıt filtreyle
              eşleşiyor.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("")
                startTransition(() =>
                  router.replace(APP_ROUTES.admin.auditLogs)
                )
              }}
            >
              Filtreleri temizle
            </Button>
          </div>
        ) : null}
      </section>

      <section
        className={cn(
          "mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-opacity",
          isNavigating && "pointer-events-none opacity-60"
        )}
      >
        <div className="hidden grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_minmax(220px,1fr)_120px_170px] gap-4 border-b border-border bg-muted/35 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase xl:grid">
          <span>İşlem</span>
          <span>Aktör</span>
          <span>Kapsam</span>
          <span>Sonuç</span>
          <span className="text-right">Zaman</span>
        </div>

        {data.items.length ? (
          data.items.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => setSelectedId(log.id)}
              className="grid w-full gap-3 border-b border-border px-5 py-4 text-left transition-colors last:border-0 hover:bg-muted/35 xl:grid-cols-[minmax(260px,1.2fr)_minmax(220px,1fr)_minmax(220px,1fr)_120px_170px] xl:items-center xl:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {actionLabel(log.action)}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {log.action}
                </p>
              </div>
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">{actorLabel(log)}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {actorTypeLabel(log.actorType)} · {originLabel(log.origin)}
                </p>
              </div>
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium">
                  {log.store?.name ?? log.workspace?.name ?? "Platform"}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {targetLabel(log)}
                </p>
              </div>
              <div>
                <ResultBadge result={log.result} />
              </div>
              <div className="text-xs xl:text-right">
                <p className="font-medium tabular-nums">
                  {formatDate(log.createdAt)}
                </p>
                {log.errorCode ? (
                  <p className="mt-1 truncate font-mono text-[10px] text-destructive">
                    {log.errorCode}
                  </p>
                ) : null}
              </div>
            </button>
          ))
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium">Kayıt bulunamadı</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seçili filtrelerle eşleşen bir denetim kaydı yok.
            </p>
          </div>
        )}
      </section>

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        onPageChange={(page) => navigate({ page })}
      />

      <AuditDetailDialog
        log={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </main>
  )
}

function AuditDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AdminAuditLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!log) return null

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={actionLabel(log.action)}
      description={formatDate(log.createdAt)}
      contentClassName="sm:max-w-3xl"
    >
      <div className="space-y-6">
        <section className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
          <ResultBadge result={log.result} />
          <Badge variant="outline">{actorTypeLabel(log.actorType)}</Badge>
          <Badge variant="outline">{originLabel(log.origin)}</Badge>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <DetailGroup title="İşlemi yapan">
            <DetailRow label="Aktör" value={actorLabel(log)} />
            {log.actor?.email ? (
              <DetailRow label="E-posta" value={log.actor.email} />
            ) : null}
            <DetailRow label="Aktör kimliği" value={log.actorUserId} mono />
          </DetailGroup>
          <DetailGroup title="Etkilenen kapsam">
            <DetailRow
              label="Çalışma alanı"
              value={log.workspace?.name ?? log.workspaceId}
            />
            <DetailRow label="Mağaza" value={log.store?.name ?? log.storeId} />
            <DetailRow label="Hedef" value={targetLabel(log)} />
          </DetailGroup>
        </section>

        <section>
          <DetailGroup title="İzleme bilgileri">
            <DetailRow label="Kayıt kimliği" value={log.id} mono />
            <DetailRow label="Request kimliği" value={log.requestId} mono />
            <DetailRow label="IP adresi" value={log.ipAddress} mono />
            <DetailRow label="İstemci" value={log.userAgent} />
            <DetailRow label="Hata kodu" value={log.errorCode} mono />
          </DetailGroup>
        </section>

        {log.before ? (
          <JsonBlock title="Önceki durum" value={log.before} />
        ) : null}
        {log.after ? (
          <JsonBlock title="Sonraki durum" value={log.after} />
        ) : null}
        {log.metadata ? (
          <JsonBlock title="İşlem ayrıntıları" value={log.metadata} />
        ) : null}
      </div>
    </ResponsiveDialog>
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
  tone?: "neutral" | "danger"
}) {
  return (
    <div className="flex items-start justify-between gap-4 bg-card p-5">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {value.toLocaleString("tr-TR")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
      </div>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          tone === "danger" && "bg-destructive/10 text-destructive"
        )}
      >
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
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
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  includeAll?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className="min-w-32 bg-background">
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

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (total === 0) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        {total.toLocaleString("tr-TR")} kayıt · Sayfa {page}/{totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
          Önceki
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Sonraki
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ResultBadge({ result }: { result: AuditResult }) {
  const item = {
    SUCCESS: {
      label: "Başarılı",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    FAILURE: {
      label: "Başarısız",
      className: "border-destructive/20 bg-destructive/8 text-destructive",
    },
    STARTED: {
      label: "Başlatıldı",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  }[result]
  return (
    <Badge variant="outline" className={cn("text-[10px]", item.className)}>
      {item.label}
    </Badge>
  )
}

function DetailGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="mt-2 divide-y divide-border border-y border-border">
        {children}
      </dl>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-6 py-2.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "max-w-[70%] text-right font-medium break-all",
          mono && "font-mono text-[10px]"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function JsonBlock({
  title,
  value,
}: {
  title: string
  value: Record<string, unknown>
}) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <pre className="themed-scrollbar mt-2 max-h-64 overflow-auto rounded-xl border border-border bg-muted/35 p-4 font-mono text-[10px] leading-5 break-all whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  )
}

function actorLabel(log: AdminAuditLog) {
  if (log.actor) return log.actor.name || log.actor.email
  if (log.actorType === "SYSTEM") return "Core Asistan sistemi"
  return log.actorUserId ? "Silinmiş veya bulunamayan kullanıcı" : "Bilinmiyor"
}

function actorTypeLabel(type: AuditActorType) {
  return { USER: "Kullanıcı", ADMIN: "Yönetici", SYSTEM: "Sistem" }[type]
}

function originLabel(origin: AuditOrigin) {
  return {
    API: "API",
    WORKER: "Worker",
    WEBHOOK: "Webhook",
    SCHEDULED: "Zamanlanmış görev",
    SYSTEM: "Sistem",
  }[origin]
}

function targetLabel(log: AdminAuditLog) {
  if (!log.targetType && !log.targetId) return "Genel işlem"
  if (!log.targetId) return log.targetType ?? "Genel işlem"
  return `${log.targetType ?? "Kayıt"} · ${shortId(log.targetId)}`
}

function actionLabel(action: string) {
  return (
    ACTION_LABELS[action] ??
    action.replaceAll("_", " ").toLocaleLowerCase("tr-TR")
  )
}

const ACTION_LABELS: Record<string, string> = {
  ADMIN_SIGNED_IN: "Yönetici oturum açtı",
  ADMIN_AUTH_PROVIDER_LINKED: "Giriş sağlayıcısı bağlandı",
  ADMIN_AUTH_PROVIDER_UNLINKED: "Giriş sağlayıcısı kaldırıldı",
  ADMIN_OTHER_SESSION_REVOKED: "Diğer cihazdaki oturum sonlandırıldı",
  ADMIN_PROFILE_UPDATED: "Yönetici profili güncellendi",
  ADMIN_BILLING_RECONCILE: "Abonelik yeniden uzlaştırıldı",
  ADMIN_SYNC_RETRY: "Senkronizasyon yönetici tarafından tekrarlandı",
  SYNC_RETRY_REQUESTED: "Senkronizasyon yeniden denendi",
  ADMIN_SUPPORT_REPLY_ADDED: "Destek yanıtı eklendi",
  ADMIN_SUPPORT_INTERNAL_NOTE_ADDED: "Destek iç notu eklendi",
  ADMIN_SUPPORT_STATUS_CHANGED: "Destek talebi durumu değiştirildi",
  ADMIN_SUPPORT_ASSIGNEE_CHANGED: "Destek sorumlusu değiştirildi",
  ADMIN_CONTACT_MESSAGE_STATUS_CHANGED: "İletişim mesajı durumu değiştirildi",
  TEAM_INVITATION_CREATED: "Ekip daveti oluşturuldu",
  TEAM_INVITATION_LINK_RENEWED: "Davet bağlantısı yenilendi",
  TEAM_INVITATION_REVOKED: "Ekip daveti iptal edildi",
  TEAM_INVITATION_ACCEPTED: "Ekip daveti kabul edildi",
  TEAM_MEMBER_ACCESS_CHANGED: "Ekip üyesi yetkileri değiştirildi",
  TEAM_MEMBER_REMOVED: "Ekip üyesi kaldırıldı",
  STORE_CREATED: "Mağaza oluşturuldu",
  STORE_UPDATED: "Mağaza güncellendi",
  STORE_ARCHIVED: "Mağaza arşivlendi",
  STORE_RESTORED: "Mağaza geri yüklendi",
  STORE_DELETED: "Mağaza kalıcı olarak silindi",
  CHANNEL_CONNECTED: "Satış kanalı bağlandı",
  CHANNEL_CONFIGURED: "Satış kanalı ayarlandı",
  CHANNEL_DISCONNECTED: "Satış kanalı bağlantısı kesildi",
  CHANNEL_RECONNECTED: "Satış kanalı yeniden bağlandı",
  CHANNEL_REMOVED: "Satış kanalı kaldırıldı",
  BILLING_CHECKOUT_OPENED: "Ödeme işlemi açıldı",
  BILLING_CHECKOUT_CANCELED: "Bekleyen ödeme iptal edildi",
  BILLING_PLAN_CHANGE_CONFIRMED: "Plan değişikliği onaylandı",
  BILLING_SUBSCRIPTION_SYNCHRONIZED: "Abonelik durumu eşitlendi",
  BILLING_TRANSACTION_RECOVERED: "Ödeme bağlantısı kurtarıldı",
  BILLING_WEBHOOK_FAILED: "Ödeme webhook'u işlenemedi",
  CATALOG_SYNC_COMPLETED: "Katalog senkronizasyonu tamamlandı",
  CATALOG_SYNC_FAILED: "Katalog senkronizasyonu başarısız",
  QUESTION_SYNC_COMPLETED: "Soru senkronizasyonu tamamlandı",
  QUESTION_SYNC_FAILED: "Soru senkronizasyonu başarısız",
  RESPONSE_SETTINGS_UPDATED: "Yanıt ayarları güncellendi",
  PRODUCT_KNOWLEDGE_VERIFIED: "Ürün bilgisi doğrulandı",
  PRODUCT_KNOWLEDGE_UPDATED: "Ürün bilgisi güncellendi",
  PRODUCT_KNOWLEDGE_ARCHIVED: "Ürün bilgisi arşivlendi",
  QUESTION_ANSWER_SENT: "Yanıt pazaryerine gönderildi",
  QUESTION_ANSWER_FAILED: "Yanıt gönderimi başarısız",
  ACCOUNT_BILLING_CLOSED: "Hesap ödemeleri kapatıldı",
  ACCOUNT_DELETED: "Kullanıcı hesabı silindi",
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

function toSearchParams(query: AdminAuditLogsQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (
      value !== undefined &&
      value !== "" &&
      !(key === "page" && value === 1) &&
      !(key === "pageSize" && value === 25) &&
      !(key === "order" && value === "NEWEST")
    ) {
      params.set(key, String(value))
    }
  }
  return params
}
