import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import type { AiPerformance } from "@/types/ai-performance"

export function ProviderPerformance({
  providers,
}: {
  providers: AiPerformance["providers"]
}) {
  if (providers.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-semibold tracking-[-0.015em] text-foreground">
          Pazaryeri performansı
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          AI kalitesini bağlı kanallar arasında karşılaştırın.
        </p>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-180">
          <div className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(5,minmax(6rem,0.7fr))] gap-4 border-b border-border bg-muted/25 px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:px-6">
            <span>Pazaryeri</span>
            <span>Taslak</span>
            <span>Ort. güven</span>
            <span>Hazır</span>
            <span>Düzenlenen</span>
            <span>Oto gönderim</span>
          </div>
          <div className="divide-y divide-border">
            {providers.map((provider) => (
              <div
                key={provider.providerKey}
                className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(5,minmax(6rem,0.7fr))] items-center gap-4 px-5 py-3.5 text-sm sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProviderLogo
                    provider={provider.providerKey}
                    className="size-8 rounded-lg"
                    sizes="32px"
                  />
                  <span className="truncate font-medium text-foreground">
                    {getProviderName(provider.providerKey)}
                  </span>
                </div>
                <Metric value={provider.totalDrafts.toLocaleString("tr-TR")} />
                <Metric
                  value={`%${formatPercent(provider.averageConfidence * 100)}`}
                />
                <Metric value={`%${formatPercent(provider.readyRate)}`} />
                <Metric
                  value={provider.editedAnswers.toLocaleString("tr-TR")}
                />
                <Metric
                  value={provider.autoSentAnswers.toLocaleString("tr-TR")}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ value }: { value: string }) {
  return (
    <span className="font-medium text-foreground tabular-nums">{value}</span>
  )
}

function formatPercent(value: number) {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })
}
