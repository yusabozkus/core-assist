import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DashboardOverview } from "@/types/dashboard"
import { dashboardNumber as number, dayLabel } from "./dashboard-format"

export function QuestionVolumeChart({ data }: { data: DashboardOverview }) {
  const maximum = Math.max(
    4,
    ...data.activity.flatMap((day) => [day.incoming, day.answered])
  )
  const ceiling = Math.ceil(maximum / 4) * 4
  const hasActivity = data.activity.some(
    (day) => day.incoming > 0 || day.answered > 0
  )

  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
      aria-labelledby="activity-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="activity-title" className="text-sm font-semibold">
            Soru akışı
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Günlük gelen ve yanıtlanan sorular
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" />
            Gelen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-chart-4" />
            Yanıtlanan
          </span>
        </div>
      </header>
      <div className="relative mt-7 pl-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
        >
          {[4, 3, 2, 1, 0].map((step) => (
            <div
              key={step}
              className="absolute right-0 left-0 flex items-center gap-2"
              style={{ top: `${(4 - step) * 25}%` }}
            >
              <span className="w-7 -translate-y-1/2 text-right text-[10px] text-muted-foreground tabular-nums">
                {number.format((ceiling * step) / 4)}
              </span>
              <span className="flex-1 border-t border-dashed border-border/70" />
            </div>
          ))}
        </div>
        <div
          className="relative grid h-48 items-end gap-1 sm:gap-2"
          style={{
            gridTemplateColumns: `repeat(${data.activity.length}, minmax(0, 1fr))`,
          }}
        >
          {data.activity.map((day) => (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${dayLabel(day.date)}: ${day.incoming} gelen, ${day.answered} yanıtlanan soru`}
                  className="group flex h-full min-w-0 items-end justify-center gap-0.5 rounded-sm outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:gap-1"
                >
                  <span
                    className="w-full max-w-5 rounded-t-[3px] bg-primary transition-opacity group-hover:opacity-80"
                    style={{
                      height: `${(day.incoming / ceiling) * 100}%`,
                      minHeight: day.incoming ? 3 : 0,
                    }}
                  />
                  <span
                    className="w-full max-w-5 rounded-t-[3px] bg-chart-4 transition-opacity group-hover:opacity-80"
                    style={{
                      height: `${(day.answered / ceiling) * 100}%`,
                      minHeight: day.answered ? 3 : 0,
                    }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1 text-xs">
                <p className="font-semibold">{dayLabel(day.date)}</p>
                <p>
                  {number.format(day.incoming)} gelen ·{" "}
                  {number.format(day.answered)} yanıtlanan
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        {!hasActivity && (
          <div className="pointer-events-none absolute inset-x-9 top-16 rounded-lg bg-card/95 px-4 py-3 text-center text-xs text-muted-foreground">
            Bu dönemde henüz soru hareketi yok.
          </div>
        )}
        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
          {data.activity
            .filter(
              (_, index) =>
                index === 0 ||
                index === Math.floor((data.activity.length - 1) / 2) ||
                index === data.activity.length - 1
            )
            .map((day) => (
              <span key={day.date}>{dayLabel(day.date)}</span>
            ))}
        </div>
      </div>
      <p className="mt-5 text-[10px] leading-4 text-muted-foreground">
        Yanıtlar gönderildikleri güne aittir; önceki günlerden gelen soruları da
        içerebilir.
      </p>
    </section>
  )
}
