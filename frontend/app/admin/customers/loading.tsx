import { Skeleton } from "@/components/ui/skeleton"

export default function AdminCustomersLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-3 h-8 w-52" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />

      <div className="mt-7 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-2.5 w-full" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mt-6 h-16 rounded-xl" />
      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <Skeleton className="h-9 rounded-none" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-t border-border px-5 py-4"
          >
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-9 flex-1" />
          </div>
        ))}
      </div>
    </main>
  )
}
