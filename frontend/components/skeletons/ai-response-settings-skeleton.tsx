import { type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

export function AiResponseSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Yanıt ayarları yükleniyor"
      className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10"
    >
      <span className="sr-only">Yanıt ayarları yükleniyor…</span>

      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-xl sm:w-[34rem]" />
        </div>
        <Skeleton className="h-8 w-36 rounded-full" />
      </header>

      <main className="mt-7 space-y-6">
        <SectionSkeleton>
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="space-y-4 rounded-lg border border-border p-4"
              >
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </SectionSkeleton>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <SectionSkeleton>
            <div className="divide-y divide-border">
              <div className="space-y-3 pb-6">
                <Skeleton className="h-4 w-28" />
                <div className="grid grid-cols-2 gap-2.5">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-21 rounded-xl" />
                  ))}
                </div>
              </div>
              <div className="space-y-3 py-6">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-5 h-2 w-full rounded-full" />
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="space-y-3 py-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-3 py-6">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <div className="space-y-3 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-44 rounded-lg" />
                </div>
              </div>
            </div>
          </SectionSkeleton>
          <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-xs xl:sticky xl:top-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-16 w-4/5 rounded-xl" />
            <Skeleton className="h-24 w-[94%] rounded-xl" />
          </div>
        </div>

        <SectionSkeleton>
          <Skeleton className="mx-auto h-4 w-56" />
          <Skeleton className="mx-auto h-3 w-72 max-w-full" />
        </SectionSkeleton>
      </main>
    </div>
  )
}

function SectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-full max-w-md sm:w-80" />
        </div>
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <div className="space-y-3 px-5 py-6 sm:px-6">{children}</div>
    </section>
  )
}
