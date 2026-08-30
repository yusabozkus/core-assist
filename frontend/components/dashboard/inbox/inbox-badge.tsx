import { Badge } from "@/components/ui/badge"

export function InboxBadge({ label, value }: { label: string; value: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-2 border-border bg-white px-3 py-1.5 text-foreground shadow-none dark:bg-card"
    >
      <span className="size-2 rounded-full bg-emerald-500" />
      {value.toLocaleString("tr-TR")} {label}
    </Badge>
  )
}
