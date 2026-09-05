import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import type { AiPerformance } from "@/types/ai-performance"
import { formatCount, formatPercent } from "./analytics-format"

export function ProviderComparison({
  providers,
}: {
  providers: AiPerformance["providers"]
}) {
  if (!providers.length) return null
  return (
    <section
      aria-labelledby="provider-comparison-title"
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="p-5 sm:p-6">
        <h2 id="provider-comparison-title" className="text-sm font-semibold">
          Pazaryeri karşılaştırması
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Seçili dönemin kanal bazında sonuçları
        </p>
      </header>
      <div className="divide-y divide-border/70 border-t border-border/70">
        {providers.map((provider) => {
          const reviewed = provider.acceptedUnchanged + provider.editedAnswers
          const stats = [
            {
              label: "Üretilen taslak",
              value: formatCount(provider.totalDrafts),
            },
            {
              label: "İnceleme kararı",
              value: provider.totalDrafts
                ? formatPercent(provider.needsReviewRate)
                : "—",
            },
            {
              label: "Değiştirilmeden onay",
              value: reviewed
                ? formatPercent((provider.acceptedUnchanged / reviewed) * 100)
                : "—",
            },
            {
              label: "Otomatik gönderim",
              value: formatCount(provider.autoSentAnswers),
            },
          ]
          return (
            <div
              key={provider.providerKey}
              className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(10rem,1.2fr)_3fr] lg:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ProviderLogo
                  provider={provider.providerKey}
                  className="size-9 rounded-lg"
                  sizes="36px"
                />
                <div>
                  <h3 className="text-xs font-semibold">
                    {getProviderName(provider.providerKey)}
                  </h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatCount(provider.sentAnswers)} toplam yanıt
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[10px] leading-4 text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="mt-1.5 text-sm font-semibold tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </section>
  )
}
