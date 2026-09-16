import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSupportLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />

      <div className="mt-7 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-border p-4 xl:border-r xl:border-b-0 xl:last:border-r-0"
          >
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border p-3">
        <div className="flex flex-col gap-3 xl:flex-row">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.6fr_0.8fr_150px_170px_120px] gap-4 border-b border-border px-5 py-4 last:border-b-0"
          >
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
        ))}
      </div>
    </main>
  )
}
