import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function DashboardOverviewSkeleton({
  contentOnly = false,
}: {
  contentOnly?: boolean
}) {
  return (
    <div
      role="status"
      aria-label="Mağaza özeti yükleniyor"
      className={cn(
        "space-y-8",
        !contentOnly &&
          "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      )}
    >
      <span className="sr-only">Mağaza özeti yükleniyor…</span>
      {!contentOnly && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="flex items-center justify-between border-b border-border pb-5">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </>
      )}

      <div className="grid overflow-hidden rounded-xl border border-border bg-card xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,1fr)]">
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex items-center gap-5">
            <Skeleton className="size-28 shrink-0 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-52 max-w-full" />
              <Skeleton className="h-3 w-60 max-w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-4 border-t border-border bg-muted/15 p-6 xl:border-t-0 xl:border-l">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-3 border-t border-border/70 pt-3"
            >
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonSectionHeading />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-5 rounded-xl border border-border bg-card p-5"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-border pt-7">
        <SkeletonSectionHeading />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="space-y-6 rounded-xl border border-border bg-card p-6"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-60 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-7">
        <SkeletonSectionHeading />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="space-y-5 rounded-xl border border-border bg-card p-6"
            >
              <Skeleton className="h-4 w-36" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="w-full space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkeletonSectionHeading() {
  return (
    <div className="space-y-2 border-l-2 border-primary/30 pl-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-96 max-w-full" />
    </div>
  )
}
