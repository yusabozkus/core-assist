export default function SupportTicketLoading() {
  return (
    <div className="flex h-full min-h-0 w-full animate-pulse flex-col sm:min-h-[620px]">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-8 sm:pt-7 sm:pb-5 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-2.5 sm:items-start sm:gap-4">
          <div className="size-9 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="h-6 w-2/3 rounded bg-muted sm:h-7" />
                <div className="mt-1 h-5 w-16 rounded-full bg-muted sm:hidden" />
                <div className="mt-3 hidden h-3.5 w-1/2 rounded bg-muted sm:block" />
                <div className="mt-2 hidden h-3 w-2/3 rounded bg-muted sm:block" />
              </div>
              <div className="hidden flex-col items-end gap-2 sm:flex">
                <div className="h-5 w-32 rounded-full bg-muted" />
                <div className="h-5 w-16 rounded-full bg-muted" />
              </div>
            </div>
          </div>
          <div className="size-9 shrink-0 rounded-full bg-muted sm:hidden" />
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 py-4 sm:px-8 sm:py-9">
        <div className="mx-auto w-full max-w-4xl">
          <div className="ml-auto h-20 w-4/5 rounded-2xl bg-muted sm:w-3/5" />
          <div className="mt-4 h-20 w-4/5 rounded-2xl bg-muted sm:mt-6 sm:w-3/5" />
          <div className="mt-4 ml-auto h-16 w-3/5 rounded-2xl bg-muted sm:mt-6 sm:w-2/5" />
        </div>
      </div>

      <div className="shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-3 sm:pb-7">
        <div className="mx-auto h-24 w-full max-w-4xl rounded-2xl border border-border bg-card sm:h-28" />
      </div>
    </div>
  )
}
