import { Skeleton } from "@/components/ui/skeleton"

export function ChannelManagementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Satış kanalları yükleniyor"
      className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 lg:px-10"
    >
      <span className="sr-only">Satış kanalları yükleniyor…</span>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-md sm:w-96" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>

        <div className="flex gap-2 sm:self-center">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      <section>
        <div className="mb-4 space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <ChannelCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  )
}

function ChannelCardSkeleton() {
  return (
    <div className="flex min-h-64 flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex gap-1">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      <Skeleton className="mt-3 h-6 w-24 rounded-full" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="mt-3 h-3 w-48 max-w-full" />
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
    </div>
  )
}
