"use client"

import { useRef, useState } from "react"
import {
  CheckmarkCircle01Icon,
  ArrowRight01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

import { LandingReveal } from "./landing-reveal"
import { cn } from "@/lib/utils"
import styles from "./landing.module.css"

const tones = [
  {
    id: "professional",
    label: "Profesyonel",
    answer:
      "Merhaba, ürün regular kalıptır. Standart kesim olarak değerlendirebilirsiniz.",
  },
  {
    id: "friendly",
    label: "Samimi",
    answer:
      "Merhabalar, bu modelimiz regular, yani standart kesim. Rahat bir günlük kullanım için tercih edebilirsiniz.",
  },
  {
    id: "minimal",
    label: "Kısa ve net",
    answer: "Ürün regular, yani standart kesimdir.",
  },
] as const

export function FeaturesSection() {
  const ref = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const rightY = useTransform(scrollYProgress, [0, 1], [56, -30])

  return (
    <section ref={ref} id="features" className="bg-white py-20 sm:py-28">
      <div className={styles.container}>
        <LandingReveal className="mb-14 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-[650px]">
            <p className={`${styles.eyebrow} mb-5 text-[#607d58]`}>
              İşinize hâkim bir yardımcı
            </p>
            <h2 className={styles.sectionTitle}>
              Ürününüzü bilir.
              <br />
              Sizin gibi konuşur.
            </h2>
          </div>
          <p className="max-w-[350px] text-sm leading-7 text-[#72796f]">
            Ürün bilgisi, marka dili ve operasyon takibi. Birbirinden kopuk
            ekranlar arasında kaybolmadan, aynı çalışma alanında.
          </p>
        </LandingReveal>

        <div className={styles.featureGrid}>
          <div>
            <LandingReveal className={`${styles.featurePanel} bg-[#edf1e8]`}>
              <div className="flex items-center justify-between gap-4 text-xs text-[#66815c]">
                <span>01 / Ürün hafızası</span>
                <HugeiconsIcon icon={Layers01Icon} className="size-5" />
              </div>
              <h3 className="mt-6 text-2xl leading-snug font-medium tracking-[-.045em] sm:text-[32px]">
                Bir ürünün bütün detayları.
                <br />
                Bir cevabın arkasında.
              </h3>
              <p className="mt-4 max-w-[390px] text-sm leading-6 text-[#6f796a]">
                Açıklamalar, varyantlar, özellikler ve mevcut beden tabloları
                ürünle birlikte alınır. AI ilgili bilgiyi sorunun bağlamında
                değerlendirir.
              </p>
              <CatalogPreview />
            </LandingReveal>
            <LandingReveal className="px-1 pt-9 pb-4 sm:px-4">
              <div className="flex items-start gap-4">
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d6e0cd]">
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-4 text-[#467155]"
                  />
                </span>
                <div>
                  <h3 className="text-base font-medium">
                    “Stokta var” demeden önce kontrol eder.
                  </h3>
                  <p className="mt-2 max-w-[420px] text-sm leading-6 text-[#76816f]">
                    Stok soruları için taslaktan ve otomatik gönderimden önce
                    pazaryeri kontrol edilir. Doğrulanamayan stok, inceleme
                    gerektirir.
                  </p>
                </div>
              </div>
            </LandingReveal>
          </div>

          <motion.div
            style={reduceMotion ? undefined : { y: rightY }}
            className="lg:pt-16"
          >
            <LandingReveal
              className={`${styles.featurePanel} border border-[#e7e9e2] bg-[#fafbf8]`}
            >
              <span className="text-xs text-[#768071]">02 / Marka dili</span>
              <h3 className="mt-6 text-2xl font-medium tracking-[-.045em] sm:text-[32px]">
                Cevaplarda imzanız olsun.
              </h3>
              <p className="mt-4 text-sm leading-6 text-[#737d6c]">
                Yanıt tonunu, uzunluğunu ve özel talimatları mağazanıza göre
                belirleyin.
              </p>
              <VoicePreview />
            </LandingReveal>
            <div className="mt-7 flex items-start justify-between gap-5 rounded-2xl bg-[#e6eddf] px-6 py-7">
              <div>
                <p className="text-sm font-medium">
                  Mağaza bilgileri de cevabın bir parçası.
                </p>
                <p className="mt-2 max-w-[300px] text-xs leading-5 text-[#6b7b60]">
                  Kargo, iade politikaları ve sık sorulanları bilgi tabanında
                  tanımlayın.
                </p>
              </div>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="mt-1 size-4 shrink-0 text-[#5a7550]"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function CatalogPreview() {
  return (
    <div className="relative mt-10 pt-5 pb-1 sm:pl-5">
      <div
        aria-hidden="true"
        className="absolute inset-0 top-8 bottom-0 left-2 rotate-[-5deg] rounded-xl border border-[#cfdbc4] bg-[#dce6d2]"
      />
      <div className="relative rounded-xl border border-[#dce3d5] bg-white p-5 shadow-[0_10px_24px_-18px_#325627]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] tracking-wider text-[#96a38c] uppercase">
            Örnek ürün kaydı
          </span>
          <span className="rounded-full bg-[#f0f4eb] px-2 py-1 text-[10px] text-[#697a59]">
            6 varyant
          </span>
        </div>
        <p className="mt-4 text-sm font-medium">Regular Fit Pamuklu Gömlek</p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-[#edf0e7] py-4 text-xs">
          {[
            { id: "material", label: "Materyal", value: "Pamuk" },
            { id: "fit", label: "Kalıp", value: "Regular" },
            { id: "color", label: "Renk", value: "Beyaz" },
            { id: "sleeve", label: "Kol", value: "Kısa kol" },
          ].map((attribute) => (
            <div key={attribute.id}>
              <span className="block text-[10px] text-[#84917c]">
                {attribute.label}
              </span>
              <span className="mt-1 block text-[#3c4c32]">
                {attribute.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["XS", "S", "M", "L", "XL", "2XL"].map((size) => (
            <span
              key={size}
              className="flex h-7 min-w-8 items-center justify-center rounded border border-[#e4eadb] text-[10px] text-[#67765a]"
            >
              {size}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function VoicePreview() {
  const [toneId, setToneId] =
    useState<(typeof tones)[number]["id"]>("professional")
  const tone = tones.find((item) => item.id === toneId)!

  return (
    <div className="mt-8">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Örnek yanıt tonu"
      >
        {tones.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={toneId === option.id}
            onClick={() => setToneId(option.id)}
            className={cn(
              "rounded-full border px-3 py-2 text-[11px] transition-colors",
              toneId === option.id
                ? "border-[#233d2b] bg-[#233d2b] text-white"
                : "border-[#dfe5d6] bg-white text-[#717c68] hover:border-[#94aa82]"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <p className="rounded-2xl rounded-br-sm bg-[#e9eddf] px-4 py-3 text-xs text-[#516443]">
          Bu ürün bol kesim mi?
        </p>
      </div>
      <div
        className="mt-3 min-h-[130px] rounded-2xl rounded-bl-sm border border-[#e0e7d8] bg-white p-5"
        aria-live="polite"
      >
        <p className="mb-3 text-[10px] font-medium text-[#779666]">
          CoreAssist · Örnek yanıt
        </p>
        <p className="text-sm leading-6 text-[#405336]">{tone.answer}</p>
      </div>
      <p className="mt-3 text-[11px] text-[#8a947e]">
        Bir ton seçin, yanıtın dilini karşılaştırın.
      </p>
    </div>
  )
}
