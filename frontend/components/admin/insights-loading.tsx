import { Skeleton } from "@/components/ui/skeleton"

export function AdminInsightsLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-7 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="min-h-36 p-5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="mt-5 h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-2 h-2.5 w-full" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          {Array.from({ length: 2 }).map((__, column) => (
            <div
              key={column}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="border-b border-border p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-64 max-w-full" />
              </div>
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </main>
  )
}
