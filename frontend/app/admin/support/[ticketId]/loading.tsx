import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSupportTicketLoading() {
  return (
    <div className="flex min-h-svh flex-col lg:h-[calc(100svh-1rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="border-b border-border px-7 py-3">
        <div className="mx-auto flex max-w-[1440px] items-start gap-3">
          <Skeleton className="size-8.5 rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-3 w-96 max-w-full" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 lg:overflow-hidden">
        <section className="flex min-h-[620px] flex-1 flex-col px-8 py-7 lg:min-h-0">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
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
          <div className="mx-auto mt-6 w-full max-w-4xl">
            <Skeleton className="h-7 w-56 rounded-lg" />
            <Skeleton className="mt-2 h-30 rounded-2xl" />
          </div>
        </section>

        <aside className="hidden h-full w-80 overflow-hidden border-l border-border bg-muted/15 p-5 lg:block">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-full rounded-xl" />
          <Skeleton className="mt-3 h-9 w-full rounded-xl" />
          <Skeleton className="mt-8 h-3 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex justify-between gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
