"use client"

import { useState } from "react"
import { Loading03Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { cn } from "@/lib/utils"
import type { AdminOperation } from "@/types/admin-operations"
import {
  ADMIN_OPERATION_STATUS,
  adminOperationKindLabel,
  adminOperationProviderLabel,
  adminOperationStageLabel,
  adminOperationTriggerLabel,
  formatAdminOperationDate,
  formatAdminOperationDuration,
  formatAdminOperationNumber,
} from "./admin-operations-presentation"

export function AdminOperationDetailDialog({
  run,
  open,
  onOpenChange,
  onRetry,
  isRetrying,
}: {
  run: AdminOperation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  isRetrying: boolean
}) {
  const [copied, setCopied] = useState(false)
  if (!run) return null

  const status = ADMIN_OPERATION_STATUS[run.status]
  const metrics = resultMetrics(run)

  async function copyRunId() {
    await navigator.clipboard.writeText(run?.id ?? "")
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={adminOperationKindLabel(run.kind)}
      description={`${run.store.workspace.name} · ${run.store.name}`}
      contentClassName="sm:max-w-3xl"
      preventClose={isRetrying}
      footer={
        run.status === "FAILED" ? (
          <div className="flex w-full flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-[11px] leading-5 text-muted-foreground">
              {run.canRetry
                ? "Yeni deneme ayrı bir işlem kaydı oluşturur ve mevcut kaydı değiştirmez."
                : (run.retryBlockedReason ??
                  "Bu işlem mevcut koşullarda yeniden başlatılamaz.")}
            </p>
            {run.canRetry ? (
              <Button
                type="button"
                size="sm"
                disabled={isRetrying}
                onClick={onRetry}
              >
                <HugeiconsIcon
                  icon={isRetrying ? Loading03Icon : RefreshIcon}
                  className={cn("size-3.5", isRetrying && "animate-spin")}
                />
                {isRetrying ? "Başlatılıyor" : "Güvenli yeniden dene"}
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <section className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderLogo
              provider={run.connection.providerKey}
              className="size-11 rounded-xl shadow-none"
              sizes="44px"
            />
            <div className="min-w-0">
              <p className="font-semibold">
                {adminOperationProviderLabel(run.connection.providerKey)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {adminOperationTriggerLabel(run.trigger)} ·{" "}
                {run.connection.environment === "SANDBOX"
                  ? "Test ortamı"
                  : "Canlı ortam"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {run.isStale ? (
              <Badge
                variant="outline"
                className="border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300"
              >
                Takılmış olabilir
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className={cn("px-2.5 py-0.5 text-[10px]", status.className)}
            >
              {status.label}
            </Badge>
          </div>
        </section>

        {run.status === "RUNNING" ? (
          <section>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">
                {adminOperationStageLabel(run.stage)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                %{run.progress}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width]",
                  run.isStale && "bg-amber-500"
                )}
                style={{ width: `${Math.max(3, run.progress)}%` }}
              />
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle>İşlem sonucu</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-card px-4 py-3.5">
                <p className="text-lg font-semibold tabular-nums">
                  {formatAdminOperationNumber(metric.value)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {run.errorMessage ? (
          <section className="rounded-r-lg border-l-2 border-destructive bg-destructive/5 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-destructive uppercase">
              Hata ayrıntısı
            </p>
            <p className="mt-1.5 text-xs leading-6 break-words">
              {run.errorMessage}
            </p>
          </section>
        ) : null}

        {run.connection.failureReason ? (
          <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">
              Kanal bağlantısı
            </p>
            <p className="mt-1.5 text-xs leading-5">
              {run.connection.failureReason}
            </p>
          </section>
        ) : null}

        <section>
          <SectionTitle>Çalışma bilgileri</SectionTitle>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            <DetailRow
              label="Başlangıç"
              value={formatAdminOperationDate(run.startedAt)}
            />
            <DetailRow
              label="Tamamlanma"
              value={
                run.completedAt
                  ? formatAdminOperationDate(run.completedAt)
                  : "Devam ediyor"
              }
            />
            <DetailRow
              label="Süre"
              value={formatAdminOperationDuration(run.durationMs)}
            />
            <DetailRow
              label="Aşama"
              value={adminOperationStageLabel(run.stage)}
            />
            <DetailRow label="Kanal durumu" value={run.connection.status} />
            {run.retryOfId ? (
              <DetailRow
                label="Tekrar edilen kayıt"
                value={run.retryOfId}
                mono
              />
            ) : null}
          </dl>
        </section>

        <section className="flex items-center justify-between gap-4">
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
        </section>
      </div>
    </ResponsiveDialog>
  )
}

function resultMetrics(run: AdminOperation) {
  if (run.kind === "QUESTION") {
    return [
      { label: "Yeni soru", value: run.metrics.questionsProcessed },
      { label: "Değişmeyen", value: run.metrics.questionsUnchanged },
      {
        label: "Toplam kontrol",
        value: run.metrics.questionsProcessed + run.metrics.questionsUnchanged,
      },
    ]
  }
  if (run.kind === "INVENTORY") {
    return [
      { label: "Kontrol edilen", value: run.metrics.variantsProcessed },
      { label: "Güncellenen", value: run.metrics.variantsUpdated },
      { label: "Değişmeyen", value: run.metrics.variantsUnchanged },
      { label: "Düşük stok", value: run.metrics.lowStockAlerts },
      { label: "Tükenen", value: run.metrics.outOfStockAlerts },
    ]
  }
  return [
    { label: "İşlenen ürün", value: run.metrics.productsProcessed },
    { label: "Yeni ürün", value: run.metrics.productsCreated },
    { label: "Güncellenen", value: run.metrics.productsUpdated },
    { label: "Değişmeyen", value: run.metrics.productsUnchanged },
    { label: "Plan limiti", value: run.metrics.productsSkipped },
    { label: "Arşivlenen", value: run.metrics.productsArchived },
  ]
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
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
