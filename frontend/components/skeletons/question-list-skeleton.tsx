import { Skeleton } from "@/components/ui/skeleton"

type QuestionListItemsSkeletonProps = {
  count?: number
}

export function QuestionListItemsSkeleton({
  count = 5,
}: QuestionListItemsSkeletonProps) {
  return (
    <div className="space-y-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-transparent p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-2.5 w-12 rounded-md" />
              </div>
              <Skeleton className="mt-2.5 h-2.5 w-full rounded-md" />
              <Skeleton className="mt-2 h-2.5 w-4/5 rounded-md" />
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4 pl-14">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-2.5 w-3/4 rounded-md" />
              <Skeleton className="mt-2 h-2 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function QuestionInboxLayoutSkeleton() {
  return (
    <div className="h-full min-h-0 w-full bg-background px-0 lg:px-6">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <aside className="flex h-full min-h-0 flex-col border-r-0 border-border bg-background lg:border-r">
          <div className="shrink-0 border-b border-border p-3.5">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="mt-2.5 h-9 w-full rounded-lg" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-2">
            <QuestionListItemsSkeleton />
          </div>
        </aside>

        <div className="hidden h-full min-h-0 items-center justify-center bg-background px-8 lg:flex">
          <div className="flex flex-col items-center">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="mt-5 h-4 w-44 rounded-md" />
            <Skeleton className="mt-3 h-2.5 w-72 max-w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
