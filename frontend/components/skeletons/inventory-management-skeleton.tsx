import { Skeleton } from "@/components/ui/skeleton"

export function InventoryRowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:px-5"
        >
          <Skeleton className="size-8.5 shrink-0 rounded-lg" />
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-72" />
            <Skeleton className="h-3 w-full max-w-48" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-10 sm:block" />
        </div>
      ))}
    </div>
  )
}

export function InventoryManagementSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-card px-4 py-4">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-9 w-full lg:max-w-sm" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <div className="mt-4">
        <InventoryRowsSkeleton />
      </div>
    </div>
  )
}
