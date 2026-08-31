import { Skeleton } from "@/components/ui/skeleton"

export function SyncHistoryRowsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0 lg:px-5"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-44" />
            <Skeleton className="h-3 w-full max-w-32" />
          </div>
          <Skeleton className="hidden h-8 w-32 lg:block" />
          <Skeleton className="hidden h-4 w-40 lg:block" />
          <Skeleton className="hidden h-4 w-28 lg:block" />
          <Skeleton className="hidden h-4 w-14 lg:block" />
          <Skeleton className="hidden h-6 w-24 rounded-full lg:block" />
        </div>
      ))}
    </div>
  )
}

export function SyncHistorySkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="mt-6 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="px-4 py-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="mt-4">
        <SyncHistoryRowsSkeleton />
      </div>
    </div>
  )
}
