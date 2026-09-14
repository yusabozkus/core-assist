import Link from "next/link"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  InboxIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { APP_ROUTES } from "@/constants/site"
import type { DashboardOverview } from "@/types/dashboard"
import { queuePresentation, timeAgo } from "./dashboard-format"

export function PriorityQuestions({ data }: { data: DashboardOverview }) {
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="priority-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <h2 id="priority-title" className="text-sm font-semibold">
            Öncelikli sorular
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Önce kontrol gerekenler, ardından en uzun bekleyenler
          </p>
        </div>
        <Link
          href={`${APP_ROUTES.dashboard.inbox}?status=pending`}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Gelen kutusu
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </header>
      {data.priorityQuestions.length ? (
        <div className="divide-y divide-border/70 border-t border-border/70">
          {data.priorityQuestions.map((question) => {
            const presentation = queuePresentation[question.state]
            return (
              <Link
                key={question.id}
                href={`${APP_ROUTES.dashboard.inbox}?status=pending&question=${encodeURIComponent(question.id)}`}
                className="group flex gap-3 px-5 py-4 transition-colors outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
              >
                <ProviderLogo
                  provider={question.providerKey}
                  className="mt-0.5 size-8 rounded-lg"
                  sizes="32px"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="truncate text-[11px] font-medium text-muted-foreground">
                      {question.customerName || "Pazaryeri müşterisi"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] ${presentation.text}`}
                    >
                      <span
                        className={`size-1 rounded-full ${presentation.dot}`}
                      />
                      {presentation.label}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-5 font-medium text-foreground">
                    {question.question}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                    <span className="truncate">
                      {question.productTitle || "Ürün eşleştirmesi bekleniyor"}
                    </span>
                    <span className="shrink-0">
                      {timeAgo(question.externalCreatedAt, data.generatedAt)}
                    </span>
                  </div>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="my-auto hidden size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                />
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={data.queue.total ? InboxIcon : CheckmarkCircle01Icon}
              className="size-5"
            />
          </span>
          <p className="mt-4 text-sm font-medium">
            {data.queue.total ? "Sorularınız işleniyor" : "Bekleyen soru yok"}
          </p>
          <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
            {data.queue.total
              ? "Otomasyon kuyruğundaki sorular tamamlandıkça bu alan güncellenir."
              : "Yeni sorular geldiğinde ilgilenmeniz gerekenleri burada göreceksiniz."}
          </p>
        </div>
      )}
    </section>
  )
}
