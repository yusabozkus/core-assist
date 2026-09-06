"use client"

import { useRef, useState } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const modes = [
  {
    id: "draft",
    title: "Önce ben onaylayayım",
    description: "AI taslakları hazırlasın. Her yanıtı inceleyip siz gönderin.",
    status: "Onayınız bekleniyor",
    action: "Taslak hazırlandı",
    detail: "Cevabın son sözü sizde.",
    automatic: false,
  },
  {
    id: "automatic",
    title: "Güvenli yanıtlar gönderilsin",
    description:
      "Koşulları karşılayanlar otomatik gitsin. İnceleme gerektirenler size kalsın.",
    status: "Otomatik gönderime uygun",
    action: "Güvenlik kontrolleri tamamlandı",
    detail: "Eksik bilgi varsa gönderim durur.",
    automatic: true,
  },
] as const

export function AutomationSection() {
  const ref = useRef<HTMLElement>(null)
  const [modeId, setModeId] =
    useState<(typeof modes)[number]["id"]>("automatic")
  const mode = modes.find((item) => item.id === modeId)!
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const receiptY = useTransform(scrollYProgress, [0, 1], [30, -24])

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-[#17271f] py-20 text-[#f3f6ed] sm:py-28"
    >
      <div
        className={`${styles.container} grid items-center gap-14 lg:grid-cols-2 lg:gap-20`}
      >
        <LandingReveal>
          <p className={`${styles.eyebrow} mb-6 text-[#acbf99]`}>
            Otomasyonun sınırını siz çizin
          </p>
          <h2 className={styles.sectionTitle}>
            Biraz destek.
            <br />
            Ya da daha fazlası.
            <br />
            <span className="text-[#d9eeae]">Karar sizin.</span>
          </h2>
          <p className="mt-6 max-w-[400px] text-sm leading-7 text-[#a9b3a4]">
            İsterseniz her cevabı onaylayın. İsterseniz güvenli yanıtları
            CoreAssist’e bırakın. Bilgi eksikse veya doğrulanamıyorsa soru
            incelemeye alınır.
          </p>
          <div
            className="mt-9 space-y-2"
            role="group"
            aria-label="Otomasyon modu örneği"
          >
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={modeId === item.id}
                onClick={() => setModeId(item.id)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-[color,background-color,border-color,transform] active:scale-[0.985]",
                  modeId === item.id
                    ? "border-[#687a53] bg-[#263a2b]"
                    : "border-transparent hover:bg-white/5"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    modeId === item.id ? "border-[#d9eeae]" : "border-[#697a60]"
                  )}
                >
                  {modeId === item.id && (
                    <span className="size-2 rounded-full bg-[#d9eeae]" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="mt-1.5 block max-w-[350px] text-xs leading-5 text-[#98aa8e]">
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </LandingReveal>

        <motion.div
          style={reduceMotion ? undefined : { y: receiptY }}
          className="relative px-2 pt-5 pb-5 sm:px-6"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-2 bottom-4 rotate-[5deg] rounded-xl border border-[#516247] bg-[#33452f]"
          />
          <div className="relative rounded-xl bg-[#f7f8f2] p-6 text-[#243022] shadow-[0_25px_60px_-30px_#060d08] sm:p-8">
            <div className="flex items-center justify-between border-b border-[#e2e7d8] pb-5">
              <p className="text-xs font-medium tracking-tight">
                Yanıt kontrolü
              </p>
              <span className="text-[10px] text-[#8a967d]">Örnek akış</span>
            </div>
            <p className="mt-6 text-[11px] text-[#89977c]">Gelen soru</p>
            <p className="mt-2 text-lg font-medium tracking-tight">
              “Siyah XL stokta var mı?”
            </p>
            <div className="my-6 space-y-4">
              {[
                {
                  id: "product",
                  label: "Ürün ve varyant eşleşmesi",
                  value: "Doğrulandı",
                },
                {
                  id: "inventory",
                  label: "Güncel stok",
                  value: "Kontrol edildi",
                },
                {
                  id: "confidence",
                  label: "Güven ve kanıtlar",
                  value: "Uygun",
                },
              ].map((check) => (
                <div key={check.id} className="flex items-center gap-3 text-xs">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-4 shrink-0 text-[#628152]"
                  />
                  <span className="flex-1 text-[#78856c]">{check.label}</span>
                  <span className="text-[#456035]">{check.value}</span>
                </div>
              ))}
            </div>
            <div
              className="border-t border-dashed border-[#cdd6c1] pt-5"
              aria-live="polite"
            >
              <p className="text-[11px] text-[#77856a]">{mode.action}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-base font-medium tracking-tight">
                  {mode.status}
                </p>
                <HugeiconsIcon
                  icon={mode.automatic ? ArrowRight01Icon : Shield01Icon}
                  className="size-5 text-[#587541]"
                />
              </div>
              <p className="mt-2 text-xs text-[#8c987f]">{mode.detail}</p>
            </div>
          </div>
          <div className="relative mx-4 mt-4 flex items-center gap-3 border-l border-[#7d9764] px-4 py-2">
            <HugeiconsIcon
              icon={Shield01Icon}
              className="size-5 shrink-0 text-[#c5dc9f]"
            />
            <p className="text-xs leading-5 text-[#a5b69a]">
              Stok değişirse veya doğrulama başarısızsa
              <br className="hidden sm:block" /> otomatik gönderim durdurulur.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
