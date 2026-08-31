import type { SyncHistorySummary as SyncHistorySummaryData } from "@/types/sync-history"

export function SyncHistorySummary({
  summary,
}: {
  summary: SyncHistorySummaryData
}) {
  const items = [
    { label: "Toplam", value: summary.total, indicator: "bg-sky-500" },
    {
      label: "Başarılı",
      value: summary.completed,
      indicator: "bg-emerald-500",
    },
    {
      label: "Devam eden",
      value: summary.running,
      indicator: "bg-amber-500",
    },
    {
      label: "Başarısız",
      value: summary.failed,
      indicator: "bg-rose-500",
    },
  ]

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(odd)]:border-r"
        >
          <span className={`size-2 shrink-0 rounded-full ${item.indicator}`} />
          <span>
            <span className="block text-lg font-semibold text-foreground tabular-nums">
              {item.value.toLocaleString("tr-TR")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {item.label}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
