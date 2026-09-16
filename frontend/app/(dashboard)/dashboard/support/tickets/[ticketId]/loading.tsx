export default function SupportTicketLoading() {
  return (
    <div className="flex h-full min-h-[620px] w-full animate-pulse flex-col">
      <div className="shrink-0 border-b border-border px-4 pt-5 pb-5 sm:px-8 sm:pt-7 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1080px] items-start gap-4">
          <div className="size-8 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="h-7 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-3.5 w-1/2 rounded bg-muted" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-5 w-32 rounded-full bg-muted" />
                <div className="h-5 w-16 rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto w-full max-w-4xl">
          <div className="ml-auto h-20 w-3/5 rounded-2xl bg-muted" />
          <div className="mt-6 h-20 w-3/5 rounded-2xl bg-muted" />
          <div className="mt-6 ml-auto h-16 w-2/5 rounded-2xl bg-muted" />
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-5 sm:px-8 sm:pb-7">
        <div className="mx-auto h-28 w-full max-w-4xl rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}
