import { Skeleton } from "@/components/ui/skeleton"

export default function ActivityLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      aria-label="İşlem geçmişi yükleniyor"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-3 w-72 max-w-full rounded" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {[160, 156, 160, 116].map((width) => (
              <Skeleton
                key={width}
                className="h-9 rounded-lg"
                style={{ width }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[92, 70, 96, 76, 68].map((width) => (
            <Skeleton
              key={width}
              className="h-8 rounded-lg"
              style={{ width }}
            />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="space-y-2 border-b border-border p-5">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <div className="border-b border-border bg-muted/20 px-5 py-2.5">
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex gap-3 border-b border-border/70 p-5 last:border-0"
          >
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex w-full justify-between gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-48 max-w-full rounded" />
                <Skeleton className="h-3 w-72 max-w-full rounded" />
              </div>
              <div className="hidden items-center gap-2.5 lg:flex">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
