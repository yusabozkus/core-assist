import { Skeleton } from "@/components/ui/skeleton"

export default function AdminAccountLoading() {
  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-7 px-5 py-8 sm:px-8 lg:px-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="hidden h-6 w-32 rounded-full sm:block" />
      </header>

      <div className="space-y-6">
        <AccountSectionSkeleton rows={2} />
        <AccountSectionSkeleton rows={2} />
        <AccountSectionSkeleton rows={3} />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </main>
  )
}

function AccountSectionSkeleton({ rows }: { rows: number }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-6 py-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-52 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  )
}
