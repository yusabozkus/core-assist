import { Skeleton } from "@/components/ui/skeleton"

export default function AdminEmailsLoading() {
  return (
    <main
      aria-label="E-postalar yükleniyor"
      className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-5 h-24 rounded-xl" />
      <Skeleton className="mt-6 h-28 rounded-xl" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </main>
  )
}
