"use client"

import { useState } from "react"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Database01Icon,
  Shield01Icon,
  ChartLineData01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion } from "motion/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import type { LandingScreenshot } from "@/constants/landing-screenshots"
import { cn } from "@/lib/utils"
import { LoginScreenshot } from "./login-screenshot"

const tourViews = [
  {
    id: "inbox",
    label: "Gelen kutusu",
    icon: CheckmarkCircle01Icon,
    title: "Bir soru. İlgili ürün. Hazır bir yanıt.",
    description:
      "AI taslağını ve dayandığı ürün bilgisini birlikte görün. İnceleyin, düzenleyin ve aynı yerden yanıtlayın.",
    detail: "Ürün bilgisine dayanan yanıtlar",
  },
  {
    id: "product-detail",
    label: "Ürün bilgisi",
    icon: Database01Icon,
    title: "Yanıtın arkasında, ürünün bütün detayları.",
    description:
      "Açıklamalar, renkler, bedenler ve varyantlar birlikte değerlendirilir. Stok sorularında güncel durum ayrıca kontrol edilir.",
    detail: "Katalog, varyantlar ve güncel stok",
  },
  {
    id: "ai-performance",
    label: "AI performansı",
    icon: ChartLineData01Icon,
    title: "Sadece yanıtları değil, kararları da görün.",
    description:
      "Gönderilen yanıtları ve inceleme gerektiren soruları takip edin. AI'ın nerede yardıma ihtiyaç duyduğunu görün.",
    detail: "Yanıt akışı ve inceleme nedenleri",
  },
] as const

export function LoginProductTour({
  screenshots,
}: {
  screenshots: readonly LandingScreenshot[]
}) {
  const [activeId, setActiveId] = useState<string>("inbox")
  const reducedMotion = useReducedMotion()
  const active = tourViews.find((view) => view.id === activeId) ?? tourViews[0]
  const screenshot = screenshots.find((item) => item.id === activeId)

  return (
    <aside
      aria-label="CoreAssist çalışma alanını keşfedin"
      className="relative hidden min-w-0 overflow-hidden rounded-[28px] bg-[#172b22] text-[#f2f5ed] lg:flex lg:flex-col"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-60 -right-64 size-[650px] rounded-full border border-white/[0.035]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 -right-48 size-[490px] rounded-full border border-white/[0.035]"
      />

      <div className="relative mx-auto flex w-full max-w-[800px] flex-1 flex-col justify-center px-8 py-7 xl:px-10 2xl:px-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#a5b49f] uppercase">
            <span className="size-1.5 rounded-full bg-[#c9dda8]" />
            Trendyol ve Hepsiburada için
          </span>
          <div
            className="flex items-center -space-x-1.5"
            aria-label="Trendyol ve Hepsiburada"
          >
            <ProviderLogo
              provider="trendyol"
              className="size-8 rounded-full border-2 border-[#172b22] shadow-none"
              sizes="32px"
            />
            <ProviderLogo
              provider="hepsiburada"
              className="size-8 rounded-full border-2 border-[#172b22] shadow-none"
              sizes="32px"
            />
          </div>
        </div>

        <div className="mb-6 max-w-[540px]">
          <h2 className="text-[38px] leading-[1.08] font-medium tracking-[-0.055em] xl:text-[44px] 2xl:text-[50px]">
            Sorulara yanıt.
            <br />
            <span className="text-[#d9eeae]">İşinize zaman.</span>
          </h2>
          <p className="mt-3 text-[13px] text-[#b0bead]">
            Ürünlerinizi tanıyan AI. Kontrolü sizde olan yanıtlar.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[calc(clamp(220px,31dvh,380px)*1.6)]">
          <div
            aria-hidden="true"
            className="absolute inset-x-4 -bottom-2 h-1/2 rounded-2xl border border-white/10 bg-white/5"
          />
          <div className="relative overflow-hidden rounded-2xl border border-[#a4b79d]/25 bg-[#f5f7f0] shadow-[0_20px_45px_-28px_rgba(0,0,0,.65)]">
            <div className="flex h-8 items-center justify-between border-b border-[#dce4d6] bg-[#f5f7f0] px-4">
              <span className="flex items-center gap-2 text-[10px] font-semibold tracking-tight text-[#4a6041]">
                <span aria-hidden="true" className="flex gap-1">
                  <i className="size-1.5 rounded-full bg-[#b7c6ac]" />
                  <i className="size-1.5 rounded-full bg-[#ccd6c3]" />
                  <i className="size-1.5 rounded-full bg-[#dce3d5]" />
                </span>
                CoreAssist
              </span>
              <span className="text-[9px] text-[#819173]">
                Uygulamadan bir görünüm
              </span>
            </div>
            <div
              id="login-tour-preview"
              role="region"
              aria-labelledby={`login-tour-${active.id}`}
            >
              {screenshot && (
                <LoginScreenshot key={screenshot.src} screenshot={screenshot} />
              )}
            </div>
          </div>
          <div
            className="pointer-events-none absolute -right-3 bottom-5 hidden items-center gap-2 rounded-lg border border-[#c1d49f] bg-[#d9eeae] px-3 py-2.5 text-[#3f5a2d] shadow-sm xl:flex"
            aria-hidden="true"
          >
            <HugeiconsIcon icon={active.icon} className="size-3.5" />
            <span className="text-[10px] font-medium">{active.detail}</span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Uygulama önizlemesini seçin"
          className="mt-5 grid grid-cols-3 gap-4 border-b border-white/10"
        >
          {tourViews.map((view, index) => (
            <button
              key={view.id}
              id={`login-tour-${view.id}`}
              type="button"
              aria-pressed={active.id === view.id}
              aria-controls="login-tour-preview"
              onClick={() => setActiveId(view.id)}
              className={cn(
                "relative flex min-h-11 items-center gap-2 pt-1 pb-3 text-left text-[11px] font-medium transition-colors outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#d9eeae]/70 xl:text-xs",
                active.id === view.id
                  ? "text-[#e5f2cd]"
                  : "text-[#95a48f] hover:text-white"
              )}
            >
              <span className="text-[9px] tabular-nums opacity-55">
                0{index + 1}
              </span>
              {view.label}
              {active.id === view.id && (
                <motion.span
                  layoutId={reducedMotion ? undefined : "login-tour-indicator"}
                  transition={{ duration: 0.24 }}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#cfe5ac]"
                />
              )}
            </button>
          ))}
        </div>

        <div className="min-h-[92px] pt-4" aria-live="polite">
          <motion.div
            key={active.id}
            initial={reducedMotion ? false : { opacity: 0.3, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[14px] font-medium tracking-tight text-[#e0e9d9]">
              {active.title}
            </p>
            <p className="mt-2 max-w-[480px] text-xs leading-[1.8] text-[#a3b29a]">
              {active.description}
            </p>
          </motion.div>
        </div>

        <div className="mt-4 flex items-start gap-3 border-t border-white/10 pt-4">
          <HugeiconsIcon
            icon={Shield01Icon}
            className="mt-0.5 size-4 shrink-0 text-[#b1c896]"
          />
          <p className="max-w-[460px] text-[11px] leading-5 text-[#a0b193]">
            <span className="text-[#d6e4c7]">
              Siz onaylayın veya güvenle otomatik gönderin.
            </span>{" "}
            Bilgi eksikse soru incelemenize bırakılır.
          </p>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="mt-1 ml-auto size-3.5 shrink-0 text-[#7f9670]"
          />
        </div>
      </div>
    </aside>
  )
}
