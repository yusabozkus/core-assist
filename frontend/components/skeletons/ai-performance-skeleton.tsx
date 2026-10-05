import { Skeleton } from "@/components/ui/skeleton"

export function AiPerformanceSkeleton() {
  return (
    <div
      role="status"
      aria-label="AI performansı yükleniyor"
      className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">AI performansı yükleniyor…</span>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:flex">
          <Skeleton className="h-10 w-full rounded-lg sm:h-9 sm:w-36" />
          <Skeleton className="size-10 rounded-lg sm:size-9" />
        </div>
      </div>
      <div className="space-y-3 border-b border-border pb-5 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="hidden gap-3 sm:flex">
          <Skeleton className="h-9 w-60 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-8 w-full rounded-lg sm:w-40" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.8fr)]">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex gap-4">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-5 w-full max-w-sm" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          <Skeleton className="mt-5 h-9 w-full rounded-lg sm:w-44" />
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-8 h-7 w-36" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <Skeleton className="mt-7 h-3 w-32" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-border bg-card p-3.5 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="size-7 shrink-0 rounded-lg sm:size-8" />
                  <Skeleton className="h-4 w-full max-w-28" />
                </div>
                <Skeleton className="size-6 shrink-0 rounded-sm" />
              </div>
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-6 h-60 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
