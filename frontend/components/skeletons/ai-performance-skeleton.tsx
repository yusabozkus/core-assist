import { Skeleton } from "@/components/ui/skeleton"

export function AiPerformanceSkeleton() {
  return (
    <div
      role="status"
      aria-label="AI performansı yükleniyor"
      className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">AI performansı yükleniyor…</span>
      <div className="flex flex-wrap justify-between gap-5">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-60" />
        </div>
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-4 rounded-xl border border-border bg-card p-5"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
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
