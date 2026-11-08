import { formatCount, formatPercent } from "./analytics-format"

export function PeriodChange({
  current,
  previous,
  kind,
  improvement,
}: {
  current: number | null
  previous: number | null
  kind: "count" | "rate"
  improvement?: "up" | "down"
}) {
  if (current === null || previous === null) {
    return (
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
        Karşılaştırma için veri yok
      </p>
    )
  }
  if (kind === "count" && previous === 0 && current > 0) {
    return (
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
        Önceki dönem: 0
      </p>
    )
  }
  const change =
    Math.round(
      (kind === "rate"
        ? current - previous
        : previous
          ? ((current - previous) / previous) * 100
          : 0) * 10
    ) / 10
  const unchanged = current === previous
  const direction = current > previous ? "artış" : "azalış"
  const positive =
    !unchanged &&
    improvement &&
    (improvement === "up" ? current > previous : current < previous)
  const tone =
    unchanged || !improvement
      ? "text-muted-foreground"
      : positive
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-amber-700 dark:text-amber-400"
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] leading-4 sm:text-[11px]">
      <span className={`font-medium ${tone}`}>
        {unchanged
          ? "Değişim yok"
          : change === 0
            ? `${kind === "rate" ? "0,1 puandan az" : "%0,1’den az"} ${direction}`
            : kind === "rate"
              ? `${formatCount(Math.abs(change))} puan ${direction}`
              : `${formatPercent(Math.abs(change))} ${direction}`}
      </span>
      <span className="text-muted-foreground">
        Önceki:{" "}
        {kind === "rate" ? formatPercent(previous) : formatCount(previous)}
      </span>
    </p>
  )
}
