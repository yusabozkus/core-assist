import { Skeleton } from "@/components/ui/skeleton"

export function AiResponseSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Yanıt ayarları yükleniyor"
      className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10"
    >
      <span className="sr-only">Yanıt ayarları yükleniyor…</span>

      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-sm sm:w-80" />
        </div>
        <Skeleton className="h-8 w-36 rounded-full" />
      </header>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <main className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <SettingsSectionSkeleton content="automation" />
          <SettingsSectionSkeleton content="format" />
          <SettingsSectionSkeleton content="collapsed" last />
        </main>

        <PreviewSkeleton />
      </div>
    </div>
  )
}

function SettingsSectionSkeleton({
  content,
  last = false,
}: {
  content: "automation" | "format" | "collapsed"
  last?: boolean
}) {
  return (
    <section className={last ? undefined : "border-b border-border"}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-full max-w-md" />
          </div>
          <Skeleton className="mt-1 size-5 shrink-0 rounded-md" />
        </div>
        <Skeleton className="ml-12 h-8 w-32 rounded-lg sm:ml-0" />
      </div>

      {content === "automation" ? <AutomationContentSkeleton /> : null}
      {content === "format" ? <FormatContentSkeleton /> : null}
    </section>
  )
}

function AutomationContentSkeleton() {
  return (
    <div className="space-y-5 px-5 pb-6 sm:px-6">
      <div className="grid overflow-hidden rounded-lg border border-border md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="min-h-32 space-y-3 border-b border-border p-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <div className="flex justify-between">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-2 w-full rounded-full" />
      </div>
    </div>
  )
}

function FormatContentSkeleton() {
  return (
    <div className="divide-y divide-border px-5 pb-6 sm:px-6">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-4 py-6 first:pt-0">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <aside className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>

      <div className="space-y-5 bg-muted/25 px-5 py-5">
        <Skeleton className="h-4 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-16 w-4/5 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-24 w-[94%] rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="space-y-2 border-r border-b border-border px-4 py-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"
          >
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 border-t border-border px-5 py-4">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <div className="w-full space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </aside>
  )
}
