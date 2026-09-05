import { Badge } from "@/components/ui/badge"
import type { AiPerformance } from "@/types/ai-performance"
import type { ProductAnswerFact } from "@/types/question"

const intentLabels: Record<ProductAnswerFact, string> = {
  STOCK: "Stok",
  PRICE: "Fiyat",
  MATERIAL: "Materyal",
  DURABILITY: "Dayanıklılık",
  SHIPPING: "Kargo",
  RETURN: "İade",
  EXCHANGE: "Değişim",
  WARRANTY: "Garanti",
  SIZE: "Beden",
  COLOR: "Renk",
  FIT: "Kalıp",
  CARE: "Bakım",
  PRODUCT_CODE: "Ürün kodu",
  PRODUCT_INFO: "Ürün bilgisi",
}

export function IntentPerformance({
  intents,
}: {
  intents: AiPerformance["intents"]
}) {
  if (intents.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex items-end justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.02em]">
            Soru türlerine göre güven
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Hangi konularda otomasyona hazır olduğunuzu karşılaştırın.
          </p>
        </div>
        <Badge variant="secondary">{intents.length} kategori</Badge>
      </header>

      <div className="divide-y divide-border">
        {intents.map((intent) => (
          <div
            key={intent.intent}
            className="grid gap-3 px-5 py-3.5 sm:grid-cols-[minmax(9rem,1fr)_repeat(3,minmax(6rem,0.65fr))] sm:items-center sm:px-6"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {intentLabels[intent.intent]}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {intent.totalDrafts.toLocaleString("tr-TR")} taslak
              </p>
            </div>
            <Metric
              label="Ortalama güven"
              value={percent(intent.averageConfidence * 100)}
            />
            <Metric
              label="Oto gönderime uygun"
              value={percent(intent.autoSendEligibilityRate)}
            />
            <Metric label="Düzenleme" value={percent(intent.editRate)} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:block">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  )
}

function percent(value: number) {
  return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
}
