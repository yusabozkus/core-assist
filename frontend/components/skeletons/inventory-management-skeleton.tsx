import { Skeleton } from "@/components/ui/skeleton"

export function InventoryRowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3 sm:space-y-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-card">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-card p-4 sm:rounded-none sm:border-0 sm:border-b sm:px-4 sm:py-3 sm:last:border-b-0 lg:px-5"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg sm:size-8.5" />
            <Skeleton className="size-10 shrink-0 rounded-lg sm:size-12" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full max-w-72" />
              <Skeleton className="h-3 w-full max-w-48" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
            <Skeleton className="hidden h-4 w-10 sm:block" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 sm:hidden">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InventoryManagementSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
          <Skeleton className="mt-3 h-7 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl sm:w-40" />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-3.5 sm:p-4"
            >
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="mt-3 h-6 w-16" />
              <Skeleton className="mt-1 h-3 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-4 border-t border-border pt-6">
        <Skeleton className="h-5 w-28" />
        <div className="flex flex-col gap-3 xl:flex-row xl:justify-between">
          <Skeleton className="h-10 w-full rounded-lg xl:max-w-sm" />
          <Skeleton className="h-9 w-28 rounded-lg lg:hidden" />
          <div className="hidden flex-wrap gap-2 lg:flex">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-10 w-36 rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-4 w-full max-w-64" />
      </div>

      <div className="mt-4">
        <InventoryRowsSkeleton />
      </div>
    </div>
  )
}
