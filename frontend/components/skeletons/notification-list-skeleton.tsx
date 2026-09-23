import { Skeleton } from "@/components/ui/skeleton"

export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="divide-y divide-border border-y border-border bg-card sm:overflow-hidden sm:rounded-xl sm:border"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <Skeleton className="size-10 shrink-0 rounded-lg sm:size-9" />
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

export function NotificationsPageSkeleton({
  admin = false,
}: {
  admin?: boolean
}) {
  return (
    <div
      role="status"
      aria-label="Bildirimler yükleniyor"
      className="mx-auto w-full max-w-[920px] pb-12 sm:px-6 lg:px-8"
    >
      <div className="px-4 pt-6 sm:px-0 sm:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-40" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </div>
        <Skeleton className="mt-2 h-4 w-full max-w-80" />
      </div>
      <div className="mt-5 border-b border-border px-4 py-3 sm:mt-6 sm:px-0">
        <div
          className={`grid gap-1 sm:flex ${admin ? "grid-cols-2" : "grid-cols-3"}`}
        >
          {Array.from({ length: admin ? 2 : 3 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-lg sm:w-24" />
          ))}
        </div>
      </div>
      <div className="mt-4 sm:mt-5">
        <NotificationListSkeleton count={6} />
      </div>
    </div>
  )
}
