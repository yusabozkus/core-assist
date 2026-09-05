import type { AiPerformance } from "@/types/ai-performance"

export function AiAnswerFlow({ data }: { data: AiPerformance }) {
  const flow = [
    {
      label: "Üretilen taslak",
      value: data.summary.totalDrafts,
      detail: "Seçili dönemde hazırlanan tüm AI cevapları",
    },
    {
      label: "Gönderime hazır",
      value: data.draftDecisions.ready,
      detail: "Güven ve kanıt kontrollerini geçen taslaklar",
    },
    ...(data.shadow.evaluated > 0
      ? [
          {
            label: "Otomatik gönderime uygun",
            value: data.shadow.wouldAutoSend,
            detail: "Politikayı geçen fakat müşteriye gönderilmeyen yanıtlar",
          },
        ]
      : []),
    {
      label: "AI destekli gönderildi",
      value: data.answers.aiAssisted,
      detail: "AI taslağıyla ilişkilendirilmiş gönderimler",
    },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-semibold tracking-[-0.015em] text-foreground">
          AI yanıt akışı
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Taslağın üretimden gönderime kadar nasıl ilerlediğini takip edin.
        </p>
      </header>

      <div className="divide-y divide-border">
        {flow.map((item) => {
          const percentage =
            data.summary.totalDrafts > 0
              ? Math.min((item.value / data.summary.totalDrafts) * 100, 100)
              : 0

          return (
            <div
              key={item.label}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)_4rem] sm:items-center sm:px-6"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-right text-sm font-semibold text-foreground tabular-nums">
                {item.value.toLocaleString("tr-TR")}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid border-t border-border bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-border">
        <FlowStat
          label="İnceleme gereken"
          value={data.draftDecisions.needsReview}
        />
        <FlowStat label="Düzenlenen" value={data.answers.edited} />
        <FlowStat
          label={
            data.shadow.evaluated > 0
              ? "İncelemeye bırakılan"
              : "Manuel yazılan"
          }
          value={
            data.shadow.evaluated > 0
              ? data.shadow.keptForReview
              : data.answers.manualOnly
          }
        />
      </div>
    </section>
  )
}

function FlowStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3 first:border-t-0 sm:block sm:border-t-0 sm:px-6 sm:py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums sm:mt-1">
        {value.toLocaleString("tr-TR")}
      </p>
    </div>
  )
}
