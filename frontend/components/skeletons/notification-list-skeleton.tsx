import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function NotificationListSkeleton({
  count = 4,
  compact = false,
}: {
  count?: number
  compact?: boolean
}) {
  return (
    <div className={cn(!compact && "space-y-3")} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-start gap-3",
            compact
              ? "border-b border-border/70 px-4 py-4"
              : "rounded-xl border border-border bg-card p-4"
          )}
        >
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-3.5 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-2/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
