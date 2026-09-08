import {
  AiSparklesIcon,
  Package01Icon,
  Store01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BILLING_PREVIEW } from "@/constants/billing"
import { UsageRadialChart } from "./usage-radial-chart"

export function SubscriptionUsage() {
  const { plan, usage } = BILLING_PREVIEW
  const items = [
    {
      label: "AI ürün soruları",
      description: "Bu dönemde AI taslağı hazırlanan sorular",
      value: usage.questions,
      limit: plan.questions,
      icon: AiSparklesIcon,
    },
    {
      label: "Mağazalar",
      description: "Hesabınızda yönetilen aktif mağazalar",
      value: usage.stores,
      limit: plan.stores,
      icon: Store01Icon,
    },
    {
      label: "Kullanıcılar",
      description: "Hesabınızda erişimi bulunan kullanıcılar",
      value: usage.members,
      limit: plan.members,
      icon: UserCircleIcon,
    },
    {
      label: "Katalog ürünleri",
      description: "Tüm mağazalarınızdaki toplam ürünler",
      value: usage.products,
      limit: plan.products,
      icon: Package01Icon,
    },
  ]
  return (
    <section
      aria-labelledby="subscription-usage-title"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div>
          <h2 id="subscription-usage-title" className="text-sm font-semibold">
            Plan kullanımı
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {BILLING_PREVIEW.period}
          </p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground">
          Mevcut dönem
        </span>
      </div>
      <div className="divide-y divide-border/70 px-5 sm:px-6">
        {items.map((item) => {
          const percentage = item.limit
            ? Math.min(100, Math.round((item.value / item.limit) * 100))
            : 0
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 py-5 sm:gap-4"
            >
              <HugeiconsIcon
                icon={item.icon}
                className="hidden size-5 shrink-0 text-muted-foreground sm:block"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium">{item.label}</h3>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">
                  {item.description}
                </p>
                <p className="mt-1.5 text-xs tabular-nums sm:hidden">
                  {item.value.toLocaleString("tr-TR")}{" "}
                  <span className="text-muted-foreground">
                    / {item.limit?.toLocaleString("tr-TR") ?? "Sınırsız"}
                  </span>
                </p>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-semibold tabular-nums">
                  {item.value.toLocaleString("tr-TR")}{" "}
                  <span className="font-normal text-muted-foreground">
                    / {item.limit?.toLocaleString("tr-TR") ?? "Sınırsız"}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.limit
                    ? `${Math.max(0, item.limit - item.value).toLocaleString("tr-TR")} kullanılabilir`
                    : "Limitsiz kullanım"}
                </p>
              </div>
              <UsageRadialChart value={percentage} label={item.label} />
            </div>
          )
        })}
      </div>
      <p className="border-t border-border bg-muted/15 px-5 py-3.5 text-xs leading-5 text-muted-foreground sm:px-6">
        Soru hakkınız her faturalama döneminde yenilenir. Mağaza, kullanıcı ve
        ürün limitleri toplam kapasitenizi gösterir. Desteklenen pazaryerlerinin
        tamamı planınıza dahildir.
      </p>
    </section>
  )
}
