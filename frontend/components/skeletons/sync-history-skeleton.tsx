import { Skeleton } from "@/components/ui/skeleton"

export function SyncHistoryRowsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid gap-3 lg:block lg:overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-card">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-card px-4 py-4 lg:flex lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:px-5 lg:shadow-none lg:last:border-b-0"
        >
          <div className="lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-36" />
            <Skeleton className="mt-2 h-3 w-28" />
            <div className="mt-3 border-t border-border pt-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-48 max-w-full" />
            </div>
            <div className="mt-3 flex justify-between gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 space-y-2 lg:block">
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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex items-start justify-between gap-3 sm:items-end">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-96" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-lg sm:w-28" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bg-card px-3 py-3.5 sm:px-4 sm:py-4">
            <Skeleton className="h-3 w-24 max-w-full" />
            <Skeleton className="mt-2 h-6 w-12" />
            <Skeleton className="mt-2 h-3 w-full max-w-28" />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-40 max-w-full" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 lg:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-6 hidden flex-wrap gap-2 lg:flex">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <div className="mt-4">
        <SyncHistoryRowsSkeleton />
      </div>
    </div>
  )
}
