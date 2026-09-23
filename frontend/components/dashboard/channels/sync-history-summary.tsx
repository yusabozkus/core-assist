import type { SyncHistorySummary as SyncHistorySummaryData } from "@/types/sync-history"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function SyncHistorySummary({
  summary,
}: {
  summary: SyncHistorySummaryData
}) {
  const items = [
    {
      label: "Toplam çalışma",
      value: summary.total.toLocaleString("tr-TR"),
      detail: `${summary.completed.toLocaleString("tr-TR")} başarıyla tamamlandı`,
      indicator: "bg-sky-500",
    },
    {
      label: "Başarı oranı",
      value: summary.successRate === null ? "—" : `%${summary.successRate}`,
      detail: "Tamamlanan işlemler içinde",
      indicator: "bg-emerald-500",
    },
    {
      label: "Devam eden",
      value: summary.running.toLocaleString("tr-TR"),
      detail: summary.running
        ? "Canlı olarak güncelleniyor"
        : "Aktif işlem bulunmuyor",
      indicator: "bg-amber-500",
    },
    {
      label: "Başarısız",
      value: summary.failed.toLocaleString("tr-TR"),
      detail: summary.failed
        ? "İncelenmesi gereken işlem"
        : "Müdahale gerekmiyor",
      indicator: "bg-rose-500",
    },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 bg-card px-3 py-3.5 sm:px-4 sm:py-4"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`size-2 shrink-0 rounded-full ${item.indicator}`}
              />
              {item.label}
            </div>
            <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground tabular-nums sm:text-2xl">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        Son başarılı çalışma:{" "}
        <span className="font-medium text-foreground">
          {summary.lastSuccessfulAt
            ? dateFormatter.format(new Date(summary.lastSuccessfulAt))
            : "Henüz yok"}
        </span>
      </div>
    </div>
  )
}
