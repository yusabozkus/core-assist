import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSupportTicketLoading() {
  return (
    <div className="flex min-h-svh flex-col lg:h-[calc(100svh-1rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="border-b border-border px-7 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="size-8.5 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-6 w-2/5" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-border p-5 lg:hidden">
        <TicketInspectorSkeleton compact />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 lg:overflow-hidden">
        <section className="flex min-h-[620px] flex-1 flex-col px-8 py-7 lg:min-h-0">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={index % 2 ? "ml-auto w-2/3" : "w-3/5"}
              >
                <Skeleton className="mb-2 h-2.5 w-32" />
                <Skeleton className="h-18 rounded-2xl" />
              </div>
            ))}
          </div>
          <div className="mx-auto mt-6 w-full max-w-5xl">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="mt-2 h-30 rounded-2xl" />
          </div>
        </section>

        <aside className="hidden h-full w-88 shrink-0 overflow-hidden border-l border-border bg-muted/12 p-5 lg:block">
          <TicketInspectorSkeleton />
        </aside>
      </div>
    </div>
  )
}

function TicketInspectorSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-5 sm:grid-cols-2" : "space-y-7"}>
      <div>
        <Skeleton className="h-2.5 w-16" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
      {!compact ? (
        <div className="space-y-4">
          <Skeleton className="h-2.5 w-24" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
