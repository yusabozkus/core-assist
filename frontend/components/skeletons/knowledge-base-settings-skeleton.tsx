import { Skeleton } from "@/components/ui/skeleton"

export function KnowledgeBaseSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Bilgi tabanı yükleniyor"
      className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10"
    >
      <span className="sr-only">Bilgi tabanı yükleniyor…</span>
      <header className="flex items-start gap-4 border-b border-border pb-7">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
      </header>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <div className="flex gap-2 overflow-hidden lg:flex-col">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-10 w-40 shrink-0 rounded-lg lg:w-full"
            />
          ))}
        </div>
        <div className="min-w-0 space-y-12">
          <section className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {[1, 2, 3].map((group) => (
                <div key={group}>
                  <div className="border-b border-border bg-muted/20 px-5 py-3">
                    <Skeleton className="h-3 w-28" />
                  </div>
                  {Array.from({ length: group === 2 ? 4 : 1 }, (_, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4"
                    >
                      <div className="w-full max-w-md space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-64 max-w-full" />
                        <Skeleton className="h-4 w-52 max-w-full" />
                      </div>
                      <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-28 w-full rounded-xl" />
          </section>
        </div>
      </div>
    </div>
  )
}
