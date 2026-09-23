import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SyncProviderHealth as SyncProviderHealthData } from "@/types/sync-history"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function SyncProviderHealth({
  providers,
}: {
  providers: SyncProviderHealthData[]
}) {
  if (providers.length === 0) return null

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">Kanal durumu</h2>
        <span className="text-xs text-muted-foreground">
          Son çalışmalar baz alınır
        </span>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {providers.map((provider) => {
          const state = getProviderState(provider)
          return (
            <div
              key={provider.providerKey}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ProviderLogo
                  provider={provider.providerKey}
                  className="size-9 rounded-lg shadow-none"
                  sizes="36px"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {getProviderName(provider.providerKey)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {provider.failureReason ?? getLastRunDescription(provider)}
                  </p>
                </div>
              </div>
              <Badge
                variant={state.variant}
                className={cn("shrink-0", state.className)}
              >
                {state.label}
              </Badge>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function getProviderState(provider: SyncProviderHealthData): {
  label: string
  variant: "success" | "warning" | "secondary"
  className?: string
} {
  if (
    provider.connectionStatus === "ERROR" ||
    provider.connectionStatus === "DISCONNECTED" ||
    provider.lastRun?.status === "FAILED"
  ) {
    return {
      label: "İnceleme gerekiyor",
      variant: "secondary",
      className:
        "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    }
  }
  if (provider.lastRun?.status === "RUNNING") {
    return { label: "Senkronize ediliyor", variant: "warning" }
  }
  if (provider.connectionStatus === "CONNECTED") {
    return { label: "Sağlıklı", variant: "success" }
  }
  return { label: "Bağlantı bekliyor", variant: "secondary" }
}

function getLastRunDescription(provider: SyncProviderHealthData) {
  if (!provider.lastRun) return "Henüz çalışma yapılmadı"
  const kind =
    provider.lastRun.kind === "FULL"
      ? "Katalog"
      : provider.lastRun.kind === "INVENTORY"
        ? "Stok"
        : "Soru"
  return `${kind} · ${dateFormatter.format(new Date(provider.lastRun.startedAt))}`
}
