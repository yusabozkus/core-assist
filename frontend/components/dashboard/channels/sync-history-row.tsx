"use client"

import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  SyncHistoryItem,
  SyncHistoryStage,
  SyncHistoryStatus,
} from "@/types/sync-history"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function SyncHistoryRow({
  run,
  onSelect,
  onRetry,
  isRetrying,
}: {
  run: SyncHistoryItem
  onSelect: () => void
  onRetry: () => void
  isRetrying: boolean
}) {
  const completedAt = run.completedAt ? new Date(run.completedAt) : new Date()
  const durationMs = Math.max(
    0,
    completedAt.getTime() - new Date(run.startedAt).getTime()
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className="group rounded-xl border border-border bg-card px-4 py-4 shadow-xs transition-colors outline-none hover:bg-muted/25 focus-visible:bg-muted/35 lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:py-3.5 lg:shadow-none lg:last:border-b-0"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 lg:grid-cols-[minmax(11rem,1.1fr)_minmax(9rem,0.75fr)_minmax(12rem,1.1fr)_minmax(10rem,0.85fr)_5rem_7rem] lg:items-center lg:gap-3">
        <HistoryCell
          label="İşlem"
          className="order-2 col-span-2 lg:order-none lg:col-span-1"
        >
          <span className="block text-sm font-semibold text-foreground">
            {getSyncKindLabel(run.kind)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {getTriggerLabel(run.trigger)}
          </span>
        </HistoryCell>

        <HistoryCell label="Kanal" className="order-1 lg:order-none">
          <span className="flex min-w-0 items-center gap-2">
            <ProviderLogo
              provider={run.providerKey}
              className="size-8 rounded-lg shadow-none"
              sizes="32px"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {getProviderName(run.providerKey)}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {run.environment === "SANDBOX" ? "Test" : "Canlı"}
              </span>
            </span>
          </span>
        </HistoryCell>

        <HistoryCell
          label="Sonuç"
          className="order-3 col-span-2 border-t border-border pt-3 lg:order-none lg:col-span-1 lg:border-0 lg:pt-0"
          showMobileLabel
        >
          {run.status === "RUNNING" ? (
            <RunningProgress run={run} />
          ) : (
            <RunResult run={run} />
          )}
        </HistoryCell>

        <HistoryCell
          label="Başlangıç"
          className="order-4 lg:order-none"
          showMobileLabel
        >
          <span className="text-xs leading-5 text-muted-foreground">
            {dateFormatter.format(new Date(run.startedAt))}
          </span>
        </HistoryCell>

        <HistoryCell
          label="Süre"
          className="order-5 text-right lg:order-none lg:text-left"
          showMobileLabel
        >
          <span className="text-xs font-medium text-foreground tabular-nums">
            {formatDuration(durationMs)}
          </span>
        </HistoryCell>

        <HistoryCell
          label="Durum"
          className="order-1 justify-self-end lg:order-none lg:justify-self-start"
        >
          <SyncStatusBadge status={run.status} />
        </HistoryCell>
      </div>

      {run.errorMessage ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-5 [overflow-wrap:anywhere] break-words text-rose-600 dark:text-rose-400">
            {run.errorMessage}
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full shrink-0 border-rose-500/25 px-2.5 text-xs text-rose-600 hover:bg-rose-500/10 sm:h-7 sm:w-auto dark:text-rose-400"
            variant="outline"
            disabled={isRetrying}
            onClick={(event) => {
              event.stopPropagation()
              onRetry()
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Başlatılıyor" : "Yeniden dene"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function RunningProgress({ run }: { run: SyncHistoryItem }) {
  return (
    <div className="w-full lg:max-w-52">
      <span className="flex items-center justify-between gap-3 text-[11px] font-medium text-foreground">
        <span>{getStageLabel(run.stage)}</span>
        <span className="tabular-nums">%{run.progress}</span>
      </span>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.max(4, run.progress)}%` }}
        />
      </span>
      <span className="mt-1 block text-[10px] text-muted-foreground tabular-nums">
        {getProcessedLabel(run)}
      </span>
    </div>
  )
}

function RunResult({ run }: { run: SyncHistoryItem }) {
  const delta = getDeltaLabel(run)

  return (
    <>
      <span className="text-xs leading-5 text-foreground tabular-nums">
        {getProcessedLabel(run)}
      </span>
      {delta ? (
        <span className="block text-[10px] text-muted-foreground">{delta}</span>
      ) : null}
    </>
  )
}

function getProcessedLabel(run: SyncHistoryItem) {
  if (run.kind === "FULL") {
    return `${run.productsProcessed.toLocaleString("tr-TR")} ürün · ${run.variantsProcessed.toLocaleString("tr-TR")} varyant`
  }
  if (run.kind === "INVENTORY") {
    return `${run.variantsProcessed.toLocaleString("tr-TR")} varyant kontrol edildi`
  }
  return `${run.questionsProcessed.toLocaleString("tr-TR")} yeni soru alındı`
}

function getDeltaLabel(run: SyncHistoryItem) {
  if (run.kind === "FULL") {
    return `${run.productsCreated} yeni · ${run.productsUpdated} güncellendi · ${run.productsUnchanged} değişmedi${run.productsSkipped ? ` · ${run.productsSkipped} limit nedeniyle bekliyor` : ""}${run.productsArchived ? ` · ${run.productsArchived} arşivlendi` : ""}`
  }
  if (run.kind === "INVENTORY") {
    return `${run.variantsUpdated} güncellendi · ${run.variantsUnchanged} değişmedi`
  }
  return run.questionsUnchanged
    ? `${run.questionsUnchanged} soru daha önce alınmıştı`
    : null
}

function getSyncKindLabel(kind: SyncHistoryItem["kind"]) {
  if (kind === "FULL") return "Ürün kataloğu"
  if (kind === "INVENTORY") return "Stok kontrolü"
  return "Soru kontrolü"
}

function getTriggerLabel(trigger: SyncHistoryItem["trigger"]) {
  if (trigger === "SCHEDULED") return "Otomatik çalıştırıldı"
  if (trigger === "RETRY") return "Yeniden denendi"
  if (trigger === "ONBOARDING") return "Kurulum sırasında"
  return "Manuel çalıştırıldı"
}

function getStageLabel(stage: SyncHistoryStage) {
  if (stage === "QUEUED") return "Kuyrukta"
  if (stage === "FETCHING") return "Pazaryerinden alınıyor"
  if (stage === "PERSISTING") return "Veriler işleniyor"
  if (stage === "RECONCILING") return "Katalog karşılaştırılıyor"
  return stage === "FAILED" ? "Başarısız" : "Tamamlandı"
}

function HistoryCell({
  label,
  children,
  className,
  showMobileLabel = false,
}: {
  label: string
  children: React.ReactNode
  className?: string
  showMobileLabel?: boolean
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {showMobileLabel ? (
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground lg:hidden">
          {label}
        </span>
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function SyncStatusBadge({ status }: { status: SyncHistoryStatus }) {
  if (status === "FAILED") {
    return (
      <Badge className="border-rose-500/25 bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
        Başarısız
      </Badge>
    )
  }

  if (status === "RUNNING") {
    return <Badge variant="warning">Çalışıyor</Badge>
  }

  return <Badge variant="success">Tamamlandı</Badge>
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1_000) return "<1 sn"

  const seconds = Math.floor(milliseconds / 1_000)
  if (seconds < 60) return `${seconds} sn`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes} dk ${remainingSeconds} sn`

  const hours = Math.floor(minutes / 60)
  return `${hours} sa ${minutes % 60} dk`
}
