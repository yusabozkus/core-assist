import type { ChannelConnection } from "@/types/channel"

export function CatalogFreshness({
  connections,
}: {
  connections: ChannelConnection[]
}) {
  const isSyncing = connections.some(
    (connection) => connection.processingStartedAt
  )
  const lastInventorySyncAt = connections
    .map(
      (connection) => connection.lastInventorySyncAt ?? connection.lastSyncAt
    )
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const hasFailure = connections.some((connection) => connection.failureReason)
  const hasCompletedSync = Boolean(lastInventorySyncAt)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${isSyncing ? "animate-pulse bg-amber-500" : hasFailure ? "bg-destructive" : hasCompletedSync ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
        />
        {isSyncing
          ? "Ürün bilgileri güncelleniyor"
          : lastInventorySyncAt
            ? `Son stok kontrolü ${formatSyncDate(lastInventorySyncAt)}`
            : "Henüz stok senkronizasyonu yapılmadı"}
      </span>
      {hasFailure && !isSyncing ? (
        <span className="text-destructive">Son senkronizasyon başarısız</span>
      ) : null}
    </div>
  )
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}
