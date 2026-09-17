import { Skeleton } from "@/components/ui/skeleton"

export default function AdminBillingDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-9 w-72 max-w-full" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      <div className="mt-7 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="mt-5 h-32 rounded-xl" />
      <Skeleton className="mt-5 h-64 rounded-xl" />
    </main>
  )
}
