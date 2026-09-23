"use client"

import { useState } from "react"
import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import type { SyncHistoryItem, SyncHistoryStage } from "@/types/sync-history"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function SyncRunDetailDialog({
  run,
  open,
  onOpenChange,
  onRetry,
  isRetrying,
}: {
  run: SyncHistoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
  isRetrying: boolean
}) {
  const [copied, setCopied] = useState(false)
  if (!run) return null

  const completedAt = run.completedAt ? new Date(run.completedAt) : new Date()
  const duration = formatDuration(
    Math.max(0, completedAt.getTime() - new Date(run.startedAt).getTime())
  )
  const runId = run.id

  async function copyRunId() {
    await navigator.clipboard.writeText(runId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={getKindLabel(run.kind)}
      description={`${getProviderName(run.providerKey)} · ${dateFormatter.format(new Date(run.startedAt))}`}
      contentClassName="sm:max-w-2xl"
      footer={
        run.status === "FAILED" && onRetry ? (
          <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Yeni deneme ayrı bir geçmiş kaydı oluşturur.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                className={`size-4 ${isRetrying ? "animate-spin" : ""}`}
              />
              {isRetrying ? "Başlatılıyor..." : "Yeniden dene"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <section className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderLogo
              provider={run.providerKey}
              className="size-11 rounded-xl shadow-none"
              sizes="44px"
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {getProviderName(run.providerKey)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {getTriggerLabel(run.trigger)} ·{" "}
                {run.environment === "SANDBOX" ? "Test ortamı" : "Canlı ortam"}
              </p>
            </div>
          </div>
          <StatusBadge run={run} />
        </section>

        {run.status === "RUNNING" ? (
          <section>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">
                {getStageLabel(run.stage)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                %{run.progress}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(4, run.progress)}%` }}
              />
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle>İşlem sonucu</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {getResultMetrics(run).map((metric) => (
              <div key={metric.label} className="bg-card px-4 py-3.5">
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {metric.value.toLocaleString("tr-TR")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {run.errorMessage ? (
          <section className="border-l-2 border-rose-500 bg-rose-500/5 px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-rose-600 uppercase dark:text-rose-400">
              Hata ayrıntısı
            </p>
            <p className="mt-1.5 text-sm leading-6 [overflow-wrap:anywhere] break-words text-foreground">
              {run.errorMessage}
            </p>
          </section>
        ) : null}

        <section>
          <SectionTitle>Çalışma bilgileri</SectionTitle>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            <DetailRow
              label="Başlangıç"
              value={dateFormatter.format(new Date(run.startedAt))}
            />
            <DetailRow
              label="Tamamlanma"
              value={
                run.completedAt
                  ? dateFormatter.format(new Date(run.completedAt))
                  : "Devam ediyor"
              }
            />
            <DetailRow label="Süre" value={duration} />
            <DetailRow label="Aşama" value={getStageLabel(run.stage)} />
            {run.retryOfId ? (
              <DetailRow
                label="Tekrar edilen kayıt"
                value={shortId(run.retryOfId)}
              />
            ) : null}
          </dl>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <SectionTitle>Çalışma kimliği</SectionTitle>
              <code className="mt-1 block truncate text-xs text-muted-foreground">
                {run.id}
              </code>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyRunId()}
            >
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </section>
      </div>
    </ResponsiveDialog>
  )
}

function StatusBadge({ run }: { run: SyncHistoryItem }) {
  if (run.status === "FAILED") {
    return (
      <Badge className="border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
        Başarısız
      </Badge>
    )
  }
  if (run.status === "RUNNING")
    return <Badge variant="warning">Çalışıyor</Badge>
  return <Badge variant="success">Tamamlandı</Badge>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground sm:text-right">{value}</dd>
    </div>
  )
}

function getResultMetrics(run: SyncHistoryItem) {
  if (run.kind === "QUESTION") {
    return [
      { label: "Yeni soru", value: run.questionsProcessed },
      { label: "Zaten kayıtlı", value: run.questionsUnchanged },
      {
        label: "Toplam kontrol",
        value: run.questionsProcessed + run.questionsUnchanged,
      },
    ]
  }

  if (run.kind === "INVENTORY") {
    return [
      { label: "Kontrol edilen", value: run.variantsProcessed },
      { label: "Güncellenen", value: run.variantsUpdated },
      { label: "Değişmeyen", value: run.variantsUnchanged },
    ]
  }

  return [
    { label: "İşlenen ürün", value: run.productsProcessed },
    { label: "Yeni ürün", value: run.productsCreated },
    { label: "Güncellenen", value: run.productsUpdated },
    { label: "Değişmeyen", value: run.productsUnchanged },
    { label: "Plan limiti nedeniyle bekleyen", value: run.productsSkipped },
    { label: "İşlenen varyant", value: run.variantsProcessed },
    { label: "Arşivlenen", value: run.productsArchived },
  ]
}

function getKindLabel(kind: SyncHistoryItem["kind"]) {
  if (kind === "FULL") return "Ürün kataloğu senkronizasyonu"
  if (kind === "INVENTORY") return "Stok kontrolü"
  return "Soru kontrolü"
}

function getTriggerLabel(trigger: SyncHistoryItem["trigger"]) {
  if (trigger === "SCHEDULED") return "Otomatik çalıştırıldı"
  if (trigger === "RETRY") return "Başarısız işlem yeniden denendi"
  if (trigger === "ONBOARDING") return "Kurulum sırasında çalıştırıldı"
  return "Manuel çalıştırıldı"
}

function getStageLabel(stage: SyncHistoryStage) {
  if (stage === "QUEUED") return "Kuyrukta"
  if (stage === "FETCHING") return "Pazaryerinden alınıyor"
  if (stage === "PERSISTING") return "Veriler işleniyor"
  if (stage === "RECONCILING") return "Katalog karşılaştırılıyor"
  if (stage === "FAILED") return "Başarısız"
  return "Tamamlandı"
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1_000) return "1 saniyeden kısa"
  const seconds = Math.floor(milliseconds / 1_000)
  if (seconds < 60) return `${seconds} saniye`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} dakika ${seconds % 60} saniye`
  return `${Math.floor(minutes / 60)} saat ${minutes % 60} dakika`
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}
