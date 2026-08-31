import Image from "next/image"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { Badge } from "@/components/ui/badge"
import type { SyncHistoryItem, SyncHistoryStatus } from "@/types/sync-history"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function SyncHistoryRow({ run }: { run: SyncHistoryItem }) {
  const completedAt = run.completedAt ? new Date(run.completedAt) : new Date()
  const durationMs = Math.max(
    0,
    completedAt.getTime() - new Date(run.startedAt).getTime()
  )

  return (
    <div className="border-b border-border px-4 py-3.5 last:border-b-0 lg:px-5">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,1.1fr)_minmax(9rem,0.75fr)_minmax(11rem,1fr)_minmax(10rem,0.85fr)_5rem_7rem] lg:items-center">
        <HistoryCell label="İşlem">
          <span className="block text-sm font-semibold text-foreground">
            {getSyncKindLabel(run.kind)}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {getSyncKindDescription(run.kind)}
          </span>
        </HistoryCell>

        <HistoryCell label="Kanal">
          <span className="flex min-w-0 items-center gap-2">
            <ProviderMark providerKey={run.providerKey} />
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

        <HistoryCell label="Sonuç">
          <span className="text-xs leading-5 text-foreground tabular-nums">
            {run.kind === "FULL"
              ? `${run.productsProcessed.toLocaleString("tr-TR")} ürün · ${run.variantsProcessed.toLocaleString("tr-TR")} varyant`
              : run.kind === "INVENTORY"
                ? `${run.variantsProcessed.toLocaleString("tr-TR")} varyant kontrol edildi`
                : `${run.questionsProcessed.toLocaleString("tr-TR")} yeni soru alındı`}
          </span>
          {run.kind === "FULL" && run.productsArchived > 0 ? (
            <span className="block text-[10px] text-muted-foreground">
              {run.productsArchived.toLocaleString("tr-TR")} ürün arşivlendi
            </span>
          ) : null}
        </HistoryCell>

        <HistoryCell label="Başlangıç">
          <span className="text-xs leading-5 text-muted-foreground">
            {dateFormatter.format(new Date(run.startedAt))}
          </span>
        </HistoryCell>

        <HistoryCell label="Süre">
          <span className="text-xs font-medium text-foreground tabular-nums">
            {formatDuration(durationMs)}
          </span>
        </HistoryCell>

        <HistoryCell label="Durum">
          <SyncStatusBadge status={run.status} />
        </HistoryCell>
      </div>

      {run.errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs leading-5 text-rose-600 dark:text-rose-400">
          {run.errorMessage}
        </div>
      ) : null}
    </div>
  )
}

function getSyncKindLabel(kind: SyncHistoryItem["kind"]) {
  if (kind === "FULL") return "Ürün kataloğu"
  if (kind === "INVENTORY") return "Stok kontrolü"
  return "Soru kontrolü"
}

function getSyncKindDescription(kind: SyncHistoryItem["kind"]) {
  if (kind === "FULL") return "Tam senkronizasyon"
  if (kind === "INVENTORY") return "Yalnızca envanter"
  return "Müşteri soruları"
}

function HistoryCell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 sm:block">
      <span className="text-xs font-medium text-muted-foreground lg:hidden">
        {label}
      </span>
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

function ProviderMark({ providerKey }: { providerKey: string }) {
  const image =
    providerKey === "hepsiburada"
      ? "/merchants/hepsiburada.webp"
      : providerKey === "trendyol"
        ? "/merchants/trendyol.webp"
        : null

  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
      {image ? (
        <Image src={image} alt="" fill sizes="32px" className="object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-slate-700 uppercase">
          {providerKey.slice(0, 2)}
        </span>
      )}
    </span>
  )
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
