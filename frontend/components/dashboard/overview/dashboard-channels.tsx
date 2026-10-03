import Link from "next/link"
import {
  ArrowRight01Icon,
  PlugSocketIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { providerName } from "@/components/dashboard/inbox/question-inbox-utils"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import type { DashboardOverview } from "@/types/dashboard"
import { timeAgo } from "./dashboard-format"

export function DashboardChannels({ data }: { data: DashboardOverview }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="channels-title"
    >
      <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <h2 id="channels-title" className="text-sm font-semibold">
            Satış kanalları
          </h2>
        </div>
        <Link
          href={APP_ROUTES.dashboard.channels.root}
          className="text-xs font-medium text-primary hover:underline"
        >
          Yönet
        </Link>
      </header>
      {data.channels.length ? (
        <div className="divide-y divide-border/70 border-t border-border/70">
          {data.channels.map((channel) => {
            const running = Boolean(
              channel.processingStartedAt ||
              channel.questionSyncStartedAt ||
              channel.latestSync?.status === "RUNNING"
            )
            const label = running
              ? "Senkronize ediliyor"
              : channel.hasError
                ? "Kontrol gerekli"
                : channel.status === "CONNECTED"
                  ? "Bağlı"
                  : channel.status === "DISCONNECTED"
                    ? "Bağlantı kesildi"
                    : "Bağlantı bekliyor"
            const tone = running
              ? "text-sky-600 dark:text-sky-400"
              : channel.hasError
                ? "text-red-600 dark:text-red-400"
                : channel.status === "CONNECTED"
                  ? "text-primary"
                  : "text-muted-foreground"
            return (
              <Link
                key={channel.id}
                href={`${APP_ROUTES.dashboard.channels.sync}?provider=${encodeURIComponent(channel.providerKey)}`}
                className="block px-5 py-4 transition-colors outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <ProviderLogo
                    provider={channel.providerKey}
                    className="size-9 rounded-lg"
                    sizes="36px"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">
                      {providerName(channel.providerKey)}
                    </span>
                    <span
                      className={`mt-1 flex items-center gap-1 text-[10px] ${tone}`}
                    >
                      {running ? (
                        <HugeiconsIcon
                          icon={RefreshIcon}
                          className="size-3 motion-safe:animate-spin"
                        />
                      ) : (
                        <span className="size-1 rounded-full bg-current" />
                      )}
                      {label}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 text-muted-foreground"
                  />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-[10px]">
                  {[
                    ["Ürünler", channel.lastSyncAt],
                    ["Stok", channel.lastInventorySyncAt],
                    ["Sorular", channel.lastQuestionSyncAt],
                  ].map(([title, date]) => (
                    <div key={title}>
                      <dt className="text-muted-foreground">{title}</dt>
                      <dd
                        className="mt-1 font-medium"
                        title={
                          date
                            ? new Date(date).toLocaleString("tr-TR", {
                                timeZone: data.period.timezone,
                              })
                            : undefined
                        }
                      >
                        {timeAgo(date, data.generatedAt)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="px-6 pb-7 text-center">
          <HugeiconsIcon
            icon={PlugSocketIcon}
            className="mx-auto my-4 size-7 text-muted-foreground"
          />
          <p className="text-sm font-medium">İlk pazaryerinizi bağlayın</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Ürünlerinizi ve müşteri sorularınızı tek yerde takip etmeye
            başlayın.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href={APP_ROUTES.dashboard.channels.root}>Kanal bağla</Link>
          </Button>
        </div>
      )}
    </section>
  )
}
