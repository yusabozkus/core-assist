import type { InventorySummary as InventorySummaryData } from "@/types/inventory"

type InventorySummaryProps = {
  summary: InventorySummaryData
}

export function InventorySummary({ summary }: InventorySummaryProps) {
  const items = [
    {
      label: "Toplam stok",
      value: summary.totalStock,
      indicator: "bg-sky-500",
    },
    {
      label: "Sağlıklı",
      value: summary.healthy,
      indicator: "bg-emerald-500",
    },
    {
      label: "Azalan",
      value: summary.lowStock,
      indicator: "bg-amber-500",
    },
    {
      label: "Tükenen",
      value: summary.outOfStock,
      indicator: "bg-rose-500",
    },
    {
      label: "Kullanılamayan",
      value: summary.unavailable,
      indicator: "bg-muted-foreground/55",
    },
  ]

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(odd)]:border-r"
        >
          <span className={`size-2 shrink-0 rounded-full ${item.indicator}`} />
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-foreground tabular-nums">
              {item.value.toLocaleString("tr-TR")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.label}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
