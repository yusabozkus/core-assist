type ProductSummaryProps = {
  label: string
  value: string
  tone?: "success" | "warning"
}

export function ProductSummary({ label, value, tone }: ProductSummaryProps) {
  return (
    <div className="min-w-0">
      <p
        className={`text-[10px] font-medium tracking-wide uppercase ${tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p
        className="mt-1 truncate text-sm font-semibold text-foreground tabular-nums"
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
