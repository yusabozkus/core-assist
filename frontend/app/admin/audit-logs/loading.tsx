import { Skeleton } from "@/components/ui/skeleton"

export default function AdminAuditLogsLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-2 h-5 w-full max-w-xl" />
      <div className="mt-7 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-16 w-full rounded-xl" />
      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex gap-5 border-b p-5 last:border-0">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="hidden h-9 flex-1 sm:block" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </main>
  )
}
