import {
  AiSparklesIcon,
  Package01Icon,
  PlugSocketIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { UsageRadialChart } from "./usage-radial-chart"

const usageItems = [
  {
    label: "Yanıtlanan sorular",
    description: "Bu dönemde AI taslağı oluşturulan ürün soruları",
    value: 3420,
    limit: 5000,
    formattedValue: "3.420",
    formattedLimit: "5.000",
    icon: AiSparklesIcon,
  },
  {
    label: "Aktif mağazalar",
    description: "Planınıza bağlı olarak yönetilen mağazalar",
    value: 2,
    limit: 5,
    formattedValue: "2",
    formattedLimit: "5",
    icon: Store01Icon,
  },
  {
    label: "Bağlı kanallar",
    description: "Aktif pazaryeri bağlantılarının toplamı",
    value: 3,
    limit: 10,
    formattedValue: "3",
    formattedLimit: "10",
    icon: PlugSocketIcon,
  },
  {
    label: "Katalog ürünleri",
    description: "Tüm mağazalarda senkronize edilen ürünler",
    value: 18640,
    limit: 25000,
    formattedValue: "18.640",
    formattedLimit: "25.000",
    icon: Package01Icon,
  },
] as const

export function SubscriptionUsage() {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.015em]">Plan kullanımı</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            15 Ağustos – 15 Eylül 2026 dönemi
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-foreground">13 gün kaldı</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            15 Eylül&apos;de yenilenir
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {usageItems.map((item) => {
          const percentage = Math.min(
            100,
            Math.round((item.value / item.limit) * 100)
          )

          return (
            <div
              key={item.label}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/25 sm:px-6 sm:py-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/65 text-secondary-foreground">
                <HugeiconsIcon icon={item.icon} className="size-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-foreground">
                  {item.label}
                </h3>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                  {item.description}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tracking-[-0.01em] text-foreground tabular-nums">
                  {item.formattedValue}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    / {item.formattedLimit}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  %{percentage} kullanıldı
                </p>
              </div>

              <UsageRadialChart value={percentage} label={item.label} />
            </div>
          )
        })}
      </div>
    </section>
  )
}
