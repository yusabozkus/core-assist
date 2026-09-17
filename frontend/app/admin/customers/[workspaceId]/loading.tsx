import { Skeleton } from "@/components/ui/skeleton"

export default function AdminCustomerDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">
      <div className="flex items-start gap-3 border-b border-border pb-6">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>

      <div className="mt-6 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <div className="grid gap-6 2xl:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    </main>
  )
}
