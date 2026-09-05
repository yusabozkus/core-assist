"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const activity = [
  { day: "Pzt", answered: 34, received: 45 },
  { day: "Sal", answered: 48, received: 59 },
  { day: "Çar", answered: 42, received: 56 },
  { day: "Per", answered: 63, received: 77 },
  { day: "Cum", answered: 58, received: 70 },
  { day: "Cmt", answered: 76, received: 85 },
  { day: "Paz", answered: 72, received: 81 },
]
const chartConfig = {
  answered: { label: "Yanıtlanan", color: "#2a6449" },
  received: { label: "Gelen", color: "#b6c6a4" },
} satisfies ChartConfig

export function InsightsSection() {
  return (
    <section className="py-20 sm:py-28">
      <div
        className={`${styles.container} grid items-center gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-20`}
      >
        <LandingReveal>
          <p className={`${styles.eyebrow} mb-5 text-[#6b805f]`}>
            Gözünüz işin üzerinde olsun
          </p>
          <h2 className={styles.sectionTitle}>
            Ne yanıtlandı?
            <br />
            Nerede size
            <br className="hidden lg:block" /> ihtiyaç var?
          </h2>
          <p className="mt-6 max-w-[400px] text-sm leading-7 text-[#737f6b]">
            Yanıt akışını, inceleme nedenlerini ve AI performansını takip edin.
            En çok sorulan ürünleri ve tamamlamanız gereken bilgileri görün.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { id: "activity", label: "Yanıt akışı" },
              { id: "review", label: "İnceleme nedenleri" },
              { id: "sync", label: "Kanal durumu" },
            ].map((item) => (
              <span
                key={item.id}
                className="rounded-full border border-[#d9e2cf] px-3 py-1.5 text-[11px] text-[#66775b]"
              >
                {item.label}
              </span>
            ))}
          </div>
        </LandingReveal>
        <LandingReveal className="overflow-hidden rounded-2xl border border-[#dce4d3] bg-white">
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <div>
              <p className="text-sm font-medium">Mağazanızın haftası</p>
              <p className="mt-1 text-xs text-[#87927b]">
                Gelen ve yanıtlanan ürün soruları
              </p>
            </div>
            <span className="rounded-full bg-[#f0f4ea] px-2.5 py-1 text-[10px] text-[#7b8b6c]">
              Örnek rapor
            </span>
          </div>
          <div className="flex gap-4 px-6 pt-6 text-[11px] text-[#738164]">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-[#2a6449]" />
              Yanıtlanan
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-[#b6c6a4]" />
              Gelen
            </span>
          </div>
          <ChartContainer
            config={chartConfig}
            className="mt-4 h-[240px] w-full px-2 sm:h-[285px]"
            aria-label="Örnek haftalık gelen ve yanıtlanan soru grafiği"
          >
            <AreaChart
              accessibilityLayer
              data={activity}
              margin={{ top: 16, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="#e9eee2"
                strokeDasharray="3 6"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fill: "#87967a", fontSize: 10 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
              <Area
                type="monotone"
                dataKey="received"
                fill="var(--color-received)"
                fillOpacity={0.18}
                stroke="var(--color-received)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="answered"
                fill="var(--color-answered)"
                fillOpacity={0.08}
                stroke="var(--color-answered)"
                strokeWidth={2.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#e9eee2] bg-[#fafbf8] px-6 py-5">
            <div>
              <p className="text-xs font-medium text-[#4f6342]">
                AI performansı
              </p>
              <p className="mt-1 text-[11px] text-[#8b9780]">
                Kararların arkasını görün
              </p>
            </div>
            <div className="border-l border-[#e0e7d7] pl-5">
              <p className="text-xs font-medium text-[#4f6342]">
                Senkronizasyon geçmişi
              </p>
              <p className="mt-1 text-[11px] text-[#8b9780]">
                Bağlantıları takip edin
              </p>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  )
}
