import { Skeleton } from "@/components/ui/skeleton"

export function KnowledgeBaseSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Bilgi tabanı yükleniyor"
      className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10"
    >
      <span className="sr-only">Bilgi tabanı yükleniyor…</span>

      <header className="flex items-start gap-3 border-b border-border pb-6">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/5 max-w-lg" />
        </div>
      </header>

      <div className="mt-6 grid gap-6">
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-full max-w-md sm:w-96" />
            </div>
            <Skeleton className="h-8 w-44 rounded-lg" />
          </div>
          <div className="space-y-6 p-5 sm:p-6">
            <KnowledgeFieldSkeleton />
            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <KnowledgeFieldSkeleton key={index} />
              ))}
            </div>
            <KnowledgeFieldSkeleton />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-80 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <Skeleton className="mt-6 h-28 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function KnowledgeFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  )
}
