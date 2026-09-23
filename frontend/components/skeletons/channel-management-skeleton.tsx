import { Skeleton } from "@/components/ui/skeleton"

export function ChannelManagementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Satış kanalları yükleniyor"
      className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">Satış kanalları yükleniyor…</span>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-7 w-44 rounded" />
          <Skeleton className="h-3 w-80 max-w-full rounded" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <div className="mt-7 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 sm:gap-0 sm:p-5">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 sm:px-4 sm:first:pl-0"
          >
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-8 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>

      <section className="mt-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-3 w-72 max-w-full rounded" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
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
    <div className="flex min-h-80 flex-col rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
        </div>
        <Skeleton className="size-8 rounded-lg" />
      </div>

      <div className="mt-5 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-3 w-20 max-w-full rounded" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  )
}
