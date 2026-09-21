import { Skeleton } from "@/components/ui/skeleton"

export default function AdminOperationQueueLoading() {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-4 w-32" />
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-60" />
          <Skeleton className="mt-3 h-4 w-[min(34rem,75vw)]" />
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="mt-7 grid overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <Skeleton className="size-9 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-10" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-16 w-full rounded-xl" />
      <div className="mt-6 overflow-hidden rounded-xl border">
        <div className="border-b p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-80" />
        </div>
        <div className="space-y-4 p-5">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="mt-2 h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border">
        <div className="border-b p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
        <div className="flex min-h-64 items-center justify-center">
          <Skeleton className="size-11 rounded-xl" />
        </div>
      </div>
    </main>
  )
}
