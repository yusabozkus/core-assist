"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import {
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Package01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { cn } from "@/lib/utils"

const productImage =
  "https://productimages.hepsiburada.net/s/777/424-600/110001173018652.jpg"

const examples = [
  {
    id: "stock",
    label: "Stok sorusu",
    customer: "Ayşe K.",
    initials: "AK",
    provider: "hepsiburada",
    question: "Merhaba, yeşil XL şu an stokta var mı?",
    answer:
      "Merhaba, yeşil XL seçeneğimiz şu anda stokta mevcut. Keyifli alışverişler dileriz.",
    sources: ["Ürün kataloğu", "Güncel stok"],
    decision: "Otomatik gönderime uygun",
    confidence: "%98 güven",
    receiptTitle: "Göndermeden önce, bir kontrol daha.",
    receiptDetail: "Stok bilgisi yeniden doğrulanır.",
  },
  {
    id: "fit",
    label: "Kalıp sorusu",
    customer: "Mehmet T.",
    initials: "MT",
    provider: "trendyol",
    question: "Bol kesim mi, yoksa normal kalıp mı?",
    answer:
      "Merhaba, ürünümüz regular fit, yani standart kalıptır. Oversize bir kesime sahip değildir.",
    sources: ["Ürün özellikleri", "Kalıp bilgisi"],
    decision: "Otomatik gönderime uygun",
    confidence: "%99 güven",
    receiptTitle: "Sorunun arkasındaki anlamı yakalar.",
    receiptDetail: "Regular fit bilgisini anlaşılır bir yanıta çevirir.",
  },
  {
    id: "review",
    label: "Eksik bilgi",
    customer: "Emre A.",
    initials: "EA",
    provider: "trendyol",
    question: "Yeşil rengi yıkadıkça solar mı?",
    answer:
      "Merhaba, ürünün solmaya karşı dayanıklılığına dair doğrulanmış bir bilgi bulunmuyor. Bu nedenle solmama garantisi veremiyoruz.",
    sources: ["Ürün özellikleri", "Dayanıklılık bilgisi eksik"],
    decision: "İncelemeniz gerekiyor",
    confidence: "%60 güven",
    receiptTitle: "Bilgi eksikse, son söz sizde.",
    receiptDetail: "Bu yanıt otomatik olarak gönderilmez.",
  },
] as const

export function QuestionDemo() {
  const [activeIndex, setActiveIndex] = useState(0)
  const sceneRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end start"],
  })
  const panelY = useTransform(scrollYProgress, [0, 1], [0, -36])
  const panelRotate = useTransform(scrollYProgress, [0, 1], [-1.5, 0])
  const productY = useTransform(scrollYProgress, [0, 1], [0, -76])
  const productRotate = useTransform(scrollYProgress, [0, 1], [6, 12])
  const receiptY = useTransform(scrollYProgress, [0, 1], [0, -12])
  const active = examples[activeIndex]
  const needsReview = active.id === "review"

  return (
    <div
      ref={sceneRef}
      className="relative isolate mx-auto w-full max-w-[600px] px-1 pt-4 pb-14 sm:px-5 sm:pt-16 sm:pb-16"
    >
      <div
        aria-hidden="true"
        className="absolute top-24 right-1 bottom-14 left-9 -z-10 rotate-[5deg] rounded-[28px] border border-[#203f2f]/10 bg-[#e7eddf] sm:right-0 sm:left-12"
      />

      <motion.div
        aria-hidden="true"
        style={
          reduceMotion ? undefined : { y: productY, rotate: productRotate }
        }
        className="absolute top-0 right-4 z-20 hidden w-[230px] items-center gap-3 rounded-2xl border border-[#173b2c]/10 bg-white p-3 shadow-[0_10px_24px_-14px_rgba(23,40,31,0.25)] sm:flex"
      >
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f1f2ee]">
          <Image
            src={productImage}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[#758176]">İlgili ürün</p>
          <p className="mt-1 text-[13px] leading-[1.45] font-semibold text-[#17281f]">
            Regular Fit
            <br />
            Polo Yaka Tişört
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#647468]">
            <span className="size-2 rounded-full bg-[#557a60]" />
            Yeşil · S / M / L / XL
          </p>
        </div>
      </motion.div>

      <motion.div
        style={reduceMotion ? undefined : { y: panelY, rotate: panelRotate }}
        className="relative z-10"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[22px] border border-[#173b2c]/10 bg-white shadow-[0_30px_65px_-35px_rgba(23,40,31,0.36)]"
        >
          <div className="flex h-[68px] items-center gap-3 bg-[#17281f] px-5 text-white sm:px-6">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#d9eeae] text-[#245d46]">
              <HugeiconsIcon icon={Package01Icon} className="size-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold">Gelen kutusu</p>
              <p className="mt-0.5 text-[11px] text-[#b0beb2]">
                Sorudan yanıta, tek yerde.
              </p>
            </div>
            <span className="ml-auto rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-[#c1cbbf] sm:hidden">
              Örnek
            </span>
          </div>

          <div
            role="group"
            aria-label="Örnek soru seçin"
            className="grid grid-cols-3 gap-1 border-b border-[#17281f]/8 px-3 pt-2 sm:px-5"
          >
            {examples.map((example, index) => (
              <button
                key={example.id}
                type="button"
                aria-pressed={activeIndex === index}
                aria-controls="hero-question-example"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative cursor-pointer px-1 pt-3 pb-3.5 text-[12px] font-medium transition-colors outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#245d46] sm:text-[13px]",
                  activeIndex === index
                    ? "text-[#245d46]"
                    : "text-[#7a857b] hover:text-[#17281f]"
                )}
              >
                {example.label}
                {activeIndex === index && (
                  <motion.span
                    layoutId={reduceMotion ? undefined : "hero-demo-tab"}
                    className="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-[#245d46]"
                    transition={{ duration: 0.25 }}
                  />
                )}
              </button>
            ))}
          </div>

          <div
            id="hero-question-example"
            aria-live="polite"
            aria-atomic="true"
            className="min-h-[300px] sm:min-h-[280px]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="px-4 pt-5 pb-4 sm:px-6 sm:pt-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf0e9] text-[11px] font-semibold text-[#4e6353]">
                      {active.initials}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-[#253c2e]">
                        {active.customer}
                      </p>
                      <p className="text-[11px] text-[#7e897f]">Örnek soru</p>
                    </div>
                  </div>
                  <ProviderLogo
                    provider={active.provider}
                    className="size-8 rounded-lg border-[#17281f]/8 shadow-none"
                    sizes="32px"
                  />
                </div>

                <p className="mt-4 text-[16px] leading-6 font-medium tracking-[-0.02em] text-[#17281f] sm:text-[17px]">
                  {active.question}
                </p>

                <div className="relative mt-5 border-l-2 border-[#245d46]/30 pl-3.5 sm:pl-4">
                  <div className="flex items-center gap-2 text-[#245d46]">
                    <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
                    <span className="text-[12px] font-semibold">
                      CoreAssist yanıtı
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.85] text-[#4c5d50] sm:text-[14px]">
                    {active.answer}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {active.sources.map((source, index) => (
                      <span
                        key={source}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                          needsReview && index === 1
                            ? "bg-[#fff2df] text-[#9a6423]"
                            : "bg-[#f0f3ec] text-[#697868]"
                        )}
                      >
                        <HugeiconsIcon
                          icon={
                            needsReview && index === 1
                              ? Clock01Icon
                              : CheckmarkCircle01Icon
                          }
                          className="size-3"
                        />
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t px-4 py-3.5 sm:px-6",
              needsReview
                ? "border-[#eddfc7] bg-[#fff8ec]"
                : "border-[#dfe8d8] bg-[#f2f7ec]"
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2 text-[11px] font-semibold sm:text-[12px]",
                needsReview ? "text-[#956020]" : "text-[#356044]"
              )}
            >
              <HugeiconsIcon
                icon={needsReview ? Shield01Icon : CheckmarkCircle01Icon}
                className="size-4 shrink-0"
              />
              {active.decision}
            </span>
            <span className="text-[11px] text-[#758172] tabular-nums">
              {active.confidence}
            </span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        style={reduceMotion ? undefined : { y: receiptY }}
        className="absolute right-3 -bottom-0.5 z-20 flex max-w-[calc(100%-24px)] items-center gap-3 rounded-xl border border-[#c7dbab] bg-[#d9eeae] px-4 py-3 text-[#294932] shadow-[0_12px_22px_-18px_rgba(23,40,31,0.35)] sm:right-0 sm:bottom-2"
      >
        <HugeiconsIcon
          icon={needsReview ? Shield01Icon : CheckmarkCircle01Icon}
          className="size-5 shrink-0"
        />
        <div>
          <p className="text-[12px] font-semibold">{active.receiptTitle}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#587044]">
            {active.receiptDetail}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
