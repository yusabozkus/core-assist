"use client"

import * as React from "react"
import {
  Analytics01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Message01Icon,
  Package01Icon,
  Search01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const channelChartConfig = {
  value: { label: "Kanal yoğunluğu", color: "#2d6b50" },
} satisfies ChartConfig

const views = [
  { id: "inbox", label: "Gelen kutusu", icon: Message01Icon },
  { id: "products", label: "Ürünler", icon: Package01Icon },
  { id: "performance", label: "Performans", icon: Analytics01Icon },
] as const

type ViewId = (typeof views)[number]["id"]

const conversations = [
  {
    initials: "AK",
    name: "Ayşe Kaya",
    subject: "Siyah XL beden stok bilgisi",
    channel: "TY",
    time: "Şimdi",
    unread: true,
  },
  {
    initials: "MU",
    name: "Mert Uzun",
    subject: "Sipariş teslimat durumu",
    channel: "WA",
    time: "4 dk",
    unread: false,
  },
  {
    initials: "ED",
    name: "Ece Demir",
    subject: "Ürün değişim talebi",
    channel: "HB",
    time: "11 dk",
    unread: false,
  },
]

const products = [
  {
    name: "Oversize Basic Tişört",
    sku: "TS-1042",
    stock: 38,
    status: "Stokta",
  },
  { name: "Kanvas Günlük Çanta", sku: "CN-2081", stock: 12, status: "Stokta" },
  { name: "Klasik Oxford Gömlek", sku: "GM-1160", stock: 4, status: "Kritik" },
]

function InboxView() {
  return (
    <div className="grid min-h-59.5 grid-cols-[minmax(0,1fr)_170px] gap-4">
      <div className="overflow-hidden rounded-xl border border-[#dfe6e2] bg-white">
        <div className="flex items-center justify-between border-b border-[#e7ece9] px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-[#1b2722]">
              Öncelikli konuşmalar
            </p>
            <p className="mt-0.5 text-[10px] text-[#7c8882]">
              Son müşteri talepleri
            </p>
          </div>
          <span className="rounded-md bg-[#edf3ef] px-2 py-1 text-[9px] font-semibold text-[#315e49]">
            3 yeni
          </span>
        </div>

        <div className="divide-y divide-[#edf0ee]">
          {conversations.map((conversation) => (
            <button
              key={conversation.name}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f7f9f8] focus-visible:bg-[#f3f6f4] focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#e8eeea] text-[10px] font-bold text-[#345345]">
                {conversation.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-[#24322c]">
                    {conversation.name}
                  </span>
                  <span className="text-[9px] font-bold text-[#85918b]">
                    {conversation.channel}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[#7c8882]">
                  {conversation.subject}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 text-[9px] text-[#89948e]">
                {conversation.time}
                {conversation.unread && (
                  <span className="size-1.5 rounded-full bg-[#286a4d]" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-xl bg-[#e8efeb] p-4">
        <div>
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#275a43] shadow-xs">
            <HugeiconsIcon icon={Clock01Icon} className="size-4" />
          </span>
          <p className="mt-4 text-[10px] font-medium text-[#6c7d74]">
            Ortalama yanıt
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#17241e]">
            1 dk 12 sn
          </p>
        </div>
        <div className="border-t border-[#d4dfd9] pt-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-[#286a4d]">
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
            Bu hafta %18 daha hızlı
          </p>
        </div>
      </div>
    </div>
  )
}

function ProductsView() {
  return (
    <div className="min-h-59.5 overflow-hidden rounded-xl border border-[#dfe6e2] bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_80px_72px] gap-3 border-b border-[#e7ece9] bg-[#fafbfa] px-4 py-2.5 text-[9px] font-semibold tracking-[0.08em] text-[#8a958f] uppercase">
        <span>Ürün</span>
        <span>Stok</span>
        <span>Durum</span>
      </div>
      <div className="divide-y divide-[#edf0ee]">
        {products.map((product) => (
          <button
            key={product.sku}
            type="button"
            className="grid w-full grid-cols-[minmax(0,1fr)_80px_72px] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f7f9f8] focus-visible:bg-[#f3f6f4] focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ef] text-[#4d6458]">
                <HugeiconsIcon icon={Package01Icon} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-[#24322c]">
                  {product.name}
                </span>
                <span className="mt-0.5 block text-[9px] text-[#89948e]">
                  {product.sku}
                </span>
              </span>
            </span>
            <span className="text-xs font-semibold text-[#33423b]">
              {product.stock} adet
            </span>
            <span
              className={
                product.status === "Kritik"
                  ? "w-fit rounded-md bg-[#fff1e7] px-2 py-1 text-[9px] font-semibold text-[#a34d16]"
                  : "w-fit rounded-md bg-[#eaf4ee] px-2 py-1 text-[9px] font-semibold text-[#276046]"
              }
            >
              {product.status}
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-[#e7ece9] bg-[#fafbfa] px-4 py-2.5 text-[9px] text-[#77847d]">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="size-3 text-[#2f7655]"
        />
        Stoklar 2 dakika önce güncellendi
      </div>
    </div>
  )
}

function PerformanceView() {
  const channels = [
    { label: "Trendyol", value: 82, count: "84 talep" },
    { label: "WhatsApp", value: 64, count: "57 talep" },
    { label: "Hepsiburada", value: 43, count: "31 talep" },
  ]

  return (
    <div className="grid min-h-59.5 grid-cols-[minmax(0,1fr)_190px] gap-4">
      <div className="rounded-xl border border-[#dfe6e2] bg-white p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#1b2722]">
              Kanal yoğunluğu
            </p>
            <p className="mt-0.5 text-[10px] text-[#7c8882]">
              Son 7 günlük dağılım
            </p>
          </div>
          <span className="text-[9px] text-[#89948e]">172 talep</span>
        </div>
        <div className="space-y-4">
          {channels.map((channel) => (
            <div key={channel.label}>
              <div className="mb-1.5 flex items-center justify-between text-[10px]">
                <span className="font-medium text-[#425149]">
                  {channel.label}
                </span>
                <span className="text-[#89948e]">{channel.count}</span>
              </div>
              <ChartContainer
                config={channelChartConfig}
                className="aspect-auto h-1.5 w-full overflow-hidden rounded-full bg-[#edf1ef]"
                initialDimension={{ width: 240, height: 6 }}
                aria-hidden="true"
              >
                <BarChart
                  data={[channel]}
                  layout="vertical"
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  accessibilityLayer={false}
                  barSize={6}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="label" hide />
                  <Bar
                    dataKey="value"
                    fill="var(--color-value)"
                    radius={3}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-rows-2 gap-4">
        <div className="rounded-xl bg-[#e8efeb] p-4">
          <p className="text-[10px] text-[#6c7d74]">Çözülen talepler</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-[#17241e]">
            %91
          </p>
        </div>
        <div className="rounded-xl border border-white/70 bg-[#dce8e1] p-4">
          <p className="text-[10px] text-[#62766b]">Aktif mağaza</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-[#17241e]">
            4
          </p>
        </div>
      </div>
    </div>
  )
}

export function LoginProductTour() {
  const [activeView, setActiveView] = React.useState<ViewId>("inbox")

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f4f7f5] text-[#17201d] shadow-[0_28px_70px_-28px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-[#dfe6e2] bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#174b38] text-white">
            <HugeiconsIcon icon={Store01Icon} className="size-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-[#1f2c26]">
              TshirtLab
            </p>
            <p className="text-[9px] text-[#8a958f]">Ana mağaza</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-8 w-36 items-center gap-2 rounded-lg border border-[#e1e6e3] bg-[#f8faf9] px-2.5 text-[9px] text-[#97a19c] xl:w-44">
            <HugeiconsIcon icon={Search01Icon} className="size-3.5" />
            Ara...
          </span>
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#dce7e1] text-[9px] font-bold text-[#315844]">
            YK
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 border-b border-[#dfe6e2] bg-[#f9fbfa] px-3 py-2"
        aria-label="Ürün tanıtım bölümleri"
      >
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={activeView === view.id}
            onClick={() => setActiveView(view.id)}
            className={
              activeView === view.id
                ? "flex items-center gap-1.5 rounded-lg bg-[#174b38] px-3 py-2 text-[10px] font-semibold text-white shadow-sm transition-colors"
                : "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-medium text-[#66736c] transition-colors hover:bg-[#e9efeb] hover:text-[#26372f]"
            }
          >
            <HugeiconsIcon icon={view.icon} className="size-3.5" />
            {view.label}
          </button>
        ))}
      </div>

      <div className="p-4" aria-live="polite">
        {activeView === "inbox" && <InboxView />}
        {activeView === "products" && <ProductsView />}
        {activeView === "performance" && <PerformanceView />}
      </div>
    </div>
  )
}
