import type { InventorySummary as InventorySummaryData } from "@/types/inventory"

type InventorySummaryProps = {
  summary: InventorySummaryData
}

export function InventorySummary({ summary }: InventorySummaryProps) {
  const items = [
    {
      label: "Toplam stok",
      value: summary.totalStock,
      unit: "adet",
      indicator: "bg-sky-500",
    },
    {
      label: "Sağlıklı",
      value: summary.healthy,
      unit: "varyant",
      indicator: "bg-emerald-500",
    },
    {
      label: "Azalan",
      value: summary.lowStock,
      unit: "varyant",
      indicator: "bg-amber-500",
    },
    {
      label: "Tükenen",
      value: summary.outOfStock,
      unit: "varyant",
      indicator: "bg-rose-500",
    },
    {
      label: "Kullanılamayan",
      value: summary.unavailable,
      unit: "varyant",
      indicator: "bg-muted-foreground/55",
    },
    {
      label: "Güncel değil",
      value: summary.stale,
      unit: "varyant",
      indicator: "bg-violet-500",
    },
  ]

  return (
    <div
      aria-label="Mağaza stok özeti"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6"
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-xl border p-3.5 sm:p-4 ${index === 0 ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-card"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`size-2 shrink-0 rounded-full ${item.indicator}`}
              aria-hidden="true"
            />
            <span className="truncate text-[10px] text-muted-foreground">
              {item.unit}
            </span>
          </div>
          <p className="mt-2.5 text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">
            {item.value.toLocaleString("tr-TR")}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 font-medium text-muted-foreground sm:text-xs">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  )
}
