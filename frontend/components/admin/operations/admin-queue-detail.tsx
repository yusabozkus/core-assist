import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type { AdminOperationQueueDetail } from "@/types/admin-operations"
import {
  formatAdminOperationDate,
  formatAdminOperationDuration,
} from "./admin-operations-presentation"

const QUEUE_DESCRIPTIONS: Record<string, string> = {
  "product-sync":
    "Pazaryerlerinden ürün kataloğu ve stok değişikliklerini alan worker işlemleri.",
  "question-sync":
    "Bağlı pazaryerlerinden yeni müşteri sorularını toplayan worker işlemleri.",
  "question-draft":
    "Ürün bağlamını hazırlayan ve AI yanıt taslaklarını oluşturan worker işlemleri.",
  "question-answer":
    "Onaylanan veya otomatik gönderime uygun cevapları pazaryerine ileten worker işlemleri.",
  "size-guide":
    "Ürün görselleri ve kaynaklarından beden tablosu bilgisi çıkaran worker işlemleri.",
  "paddle-webhooks":
    "Paddle tarafından iletilen ödeme ve abonelik olaylarını güvenli biçimde işleyen worker işlemleri.",
  "billing-recovery":
    "Abonelikleri Paddle kayıtlarıyla karşılaştıran ve kaçırılan ödeme olaylarını onaran periyodik işlemler.",
  "support-notifications":
    "Destek taleplerinin yanıt hedeflerini izleyen ve gerekli bildirimleri oluşturan periyodik işlemler.",
  "data-retention":
    "Saklama süresi dolan audit, tamamlanmış senkronizasyon ve kapanmış destek kayıtlarını kontrollü partiler halinde temizleyen periyodik işlemler.",
}

export function AdminQueueDetailView({
  queue,
}: {
  queue: AdminOperationQueueDetail
}) {
  const activeLoad = queue.counts.waiting + queue.counts.active
  const retainedOldFailures = Math.max(
    0,
    queue.counts.failed - queue.recentFailuresLast24Hours
  )
  const status = resolveQueueStatus(queue)

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
      <Link
        href={APP_ROUTES.admin.operations}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        Operasyonlara dön
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {queue.label}
            </h1>
            <Badge
              variant="outline"
              className={cn("px-2.5 py-0.5 text-[10px]", status.className)}
            >
              {status.label}
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {QUEUE_DESCRIPTIONS[queue.key] ??
              "Worker kuyruğunun mevcut yükü ve hata geçmişi."}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Son kontrol · {formatAdminOperationDate(queue.generatedAt)}
        </p>
      </div>

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 xl:grid-cols-7">
        <QueueMetric
          label="Aktif yük"
          value={activeLoad}
          helper="Bekleyen ve çalışan"
          icon={RefreshIcon}
          tone={activeLoad > 0 ? "attention" : "neutral"}
        />
        <QueueMetric
          label="Bekleyen"
          value={queue.counts.waiting}
          helper="İşlenmeyi bekliyor"
          icon={Clock01Icon}
        />
        <QueueMetric
          label="Çalışan"
          value={queue.counts.active}
          helper="Şu anda işleniyor"
          icon={RefreshIcon}
          tone={queue.counts.active > 0 ? "positive" : "neutral"}
        />
        <QueueMetric
          label="Zamanlanmış"
          value={queue.counts.scheduled}
          helper="Periyodik ve bekleyen"
          icon={Clock01Icon}
        />
        <QueueMetric
          label="Süresi aşan"
          value={queue.counts.overdue}
          helper="1 dk toleransı geçti"
          icon={AlertCircleIcon}
          tone={queue.counts.overdue > 0 ? "danger" : "neutral"}
        />
        <QueueMetric
          label="Son 24 saat hata"
          value={queue.recentFailuresLast24Hours}
          helper="Yeni terminal hatalar"
          icon={AlertCircleIcon}
          tone={queue.recentFailuresLast24Hours > 0 ? "danger" : "neutral"}
        />
        <QueueMetric
          label="Saklanan hata"
          value={queue.counts.failed}
          helper={`${retainedOldFailures} eski kayıt`}
          icon={AlertCircleIcon}
        />
      </section>

      <div
        className={cn(
          "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3.5",
          status.panelClassName
        )}
      >
        <HugeiconsIcon icon={status.icon} className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-xs font-semibold">{status.title}</p>
          <p className="mt-1 text-[11px] leading-5 opacity-80">
            {status.description}
          </p>
        </div>
      </div>

      <ScheduledJobsSection queue={queue} />

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col justify-between gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Başarısız iş geçmişi</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tüm denemelerini tamamladığı halde sonuçlanamayan worker işleri.
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {queue.pagination.total} kayıt
          </span>
        </div>

        {queue.failures.length ? (
          <div className="divide-y divide-border">
            {queue.failures.map((failure) => (
              <article key={failure.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <HugeiconsIcon
                        icon={AlertCircleIcon}
                        className="size-4"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">
                        {formatQueueJobName(failure.name)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatAdminOperationDate(failure.failedAt)} ·{" "}
                        {failure.attemptsMade} deneme
                      </p>
                    </div>
                  </div>
                  <code className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-[9px] text-muted-foreground lg:max-w-sm">
                    {failure.id}
                  </code>
                </div>
                <p className="mt-3 rounded-lg bg-muted/45 px-3 py-2.5 text-[11px] leading-5 break-words text-foreground/80 sm:ml-11">
                  {failure.failedReason}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-5" />
            </span>
            <p className="mt-4 text-sm font-semibold">
              Başarısız iş bulunmuyor
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              Bu kuyrukta saklanan ve inceleme gerektiren terminal hata kaydı
              yok.
            </p>
          </div>
        )}

        {queue.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Sayfa {queue.pagination.page} / {queue.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                aria-disabled={queue.pagination.page <= 1}
                className={cn(
                  queue.pagination.page <= 1 && "pointer-events-none opacity-50"
                )}
              >
                <Link
                  href={queuePageHref(queue.key, queue.pagination.page - 1)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Önceki
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                aria-disabled={
                  queue.pagination.page >= queue.pagination.totalPages
                }
                className={cn(
                  queue.pagination.page >= queue.pagination.totalPages &&
                    "pointer-events-none opacity-50"
                )}
              >
                <Link
                  href={queuePageHref(queue.key, queue.pagination.page + 1)}
                >
                  Sonraki
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
        Başarısız işler teşhis amacıyla en fazla 7 gün ve kuyruk için belirlenen
        kayıt sınırı boyunca saklanır.
      </p>
    </main>
  )
}

function ScheduledJobsSection({ queue }: { queue: AdminOperationQueueDetail }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col justify-between gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold">Zamanlanmış işler</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Periyodik kontroller, ileri tarihli işler ve yeniden deneme
            bekleyenleri.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {queue.counts.scheduled} iş
        </span>
      </div>

      {queue.scheduledJobs.length ? (
        <div className="divide-y divide-border">
          {queue.scheduledJobs.map((job) => {
            const kind = scheduledJobKind(job.kind)
            return (
              <article
                key={job.id}
                className={cn(
                  "flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center",
                  job.overdue && "bg-destructive/3"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary",
                    job.overdue && "bg-destructive/10 text-destructive"
                  )}
                >
                  <HugeiconsIcon
                    icon={job.overdue ? AlertCircleIcon : Clock01Icon}
                    className="size-4"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold">
                      {formatQueueJobName(job.name)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("px-2 py-0 text-[9px]", kind.className)}
                    >
                      {kind.label}
                    </Badge>
                    {job.overdue ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/25 bg-destructive/8 px-2 py-0 text-[9px] text-destructive"
                      >
                        {formatAdminOperationDuration(job.overdueByMs)} gecikti
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {job.overdue ? "Planlanan zaman" : "Sonraki çalışma"}:{" "}
                    {formatAdminOperationDate(job.scheduledFor)}
                    {job.recurrence
                      ? ` · ${recurrenceLabel(job.recurrence)}`
                      : ""}
                    {job.kind === "RETRY"
                      ? ` · ${job.attemptsMade}/${job.maxAttempts || "—"} deneme`
                      : ""}
                  </p>
                </div>

                <code className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-[9px] text-muted-foreground lg:max-w-72">
                  {job.id}
                </code>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-32 flex-col items-center justify-center px-6 text-center">
          <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-4" />
          </span>
          <p className="mt-3 text-xs text-muted-foreground">
            Bu kuyrukta zamanlanmış iş bulunmuyor.
          </p>
        </div>
      )}

      {queue.counts.scheduled > queue.scheduledJobs.length ? (
        <p className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">
          İlk {queue.scheduledJobs.length} iş gösteriliyor.
        </p>
      ) : null}
    </section>
  )
}

function QueueMetric({
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

function scheduledJobKind(
  kind: AdminOperationQueueDetail["scheduledJobs"][number]["kind"]
) {
  if (kind === "RECURRING") {
    return {
      label: "Periyodik",
      className: "border-primary/20 bg-primary/6 text-primary",
    }
  }
  if (kind === "RETRY") {
    return {
      label: "Yeniden deneme",
      className:
        "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    }
  }
  return {
    label: "İleri tarihli",
    className: "border-border bg-muted/60 text-muted-foreground",
  }
}

function recurrenceLabel(
  recurrence: AdminOperationQueueDetail["scheduledJobs"][number]["recurrence"]
) {
  if (!recurrence) return ""
  if (recurrence.everyMs) {
    if (recurrence.everyMs === 86_400_000) return "Her gün"
    return `Her ${formatAdminOperationDuration(recurrence.everyMs)}`
  }
  if (recurrence.pattern) {
    return recurrence.timezone
      ? `${recurrence.pattern} · ${recurrence.timezone}`
      : recurrence.pattern
  }
  return "Periyodik"
}

function resolveQueueStatus(queue: AdminOperationQueueDetail) {
  if (!queue.available) {
    return {
      label: "Erişilemiyor",
      title: "Kuyruk bilgisi alınamıyor",
      description:
        "Redis bağlantısını ve worker servisinin çalıştığını kontrol edin.",
      icon: AlertCircleIcon,
      className: "border-destructive/25 bg-destructive/8 text-destructive",
      panelClassName: "border-destructive/20 bg-destructive/5 text-destructive",
    }
  }
  if (queue.paused) {
    return {
      label: "Duraklatıldı",
      title: "Kuyruk duraklatılmış",
      description:
        "Yeni işler Redis’te bekleyebilir ancak worker tarafından işlenmez.",
      icon: Clock01Icon,
      className:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      panelClassName:
        "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-200",
    }
  }
  if (queue.counts.overdue > 0) {
    return {
      label: "Süre aşımı",
      title: "Zamanlanmış işler çalışma zamanını geçti",
      description:
        "Worker bu işleri planlanan zamandan sonraki bir dakika içinde alamadı. Redis bağlantısını ve worker sürecini kontrol edin.",
      icon: AlertCircleIcon,
      className: "border-destructive/25 bg-destructive/8 text-destructive",
      panelClassName: "border-destructive/20 bg-destructive/5 text-destructive",
    }
  }
  if (queue.recentFailuresLast24Hours > 0) {
    return {
      label: "İnceleme gerekli",
      title: "Yakın zamanda başarısız işler var",
      description:
        "Aşağıdaki hata nedenlerini inceleyin. Eski kayıtlar tek başına mevcut sistem durumunu bozmaz.",
      icon: AlertCircleIcon,
      className: "border-destructive/25 bg-destructive/8 text-destructive",
      panelClassName: "border-destructive/20 bg-destructive/5 text-destructive",
    }
  }
  if (queue.counts.waiting > 0 || queue.counts.active > 0) {
    return {
      label: "Çalışıyor",
      title: "Kuyruk aktif olarak işleniyor",
      description:
        "Bekleyen ve çalışan işler tamamlandıkça yük değeri otomatik olarak azalır.",
      icon: RefreshIcon,
      className:
        "border-primary/25 bg-primary/8 text-primary dark:text-primary-foreground",
      panelClassName: "border-primary/20 bg-primary/5 text-primary",
    }
  }
  return {
    label: "Sağlıklı",
    title: "Kuyruk normal çalışıyor",
    description:
      "Bekleyen aktif yük veya son 24 saatte başarısız olan bir iş bulunmuyor.",
    icon: CheckmarkCircle01Icon,
    className:
      "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
    panelClassName:
      "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
  }
}

function formatQueueJobName(name: string) {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.toLocaleLowerCase("tr-TR"))
    .join(" ")
    .replace(/^./, (character) => character.toLocaleUpperCase("tr-TR"))
}

function queuePageHref(queueKey: string, page: number) {
  return `${APP_ROUTES.admin.operationQueue(queueKey)}?page=${Math.max(1, page)}`
}
