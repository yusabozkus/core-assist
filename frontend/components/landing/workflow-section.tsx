"use client"

import { useRef, type ReactNode } from "react"
import Image from "next/image"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Database01Icon,
  Link01Icon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { cn } from "@/lib/utils"
import { WorkflowProgressContext, WorkflowReveal } from "./workflow-reveal"
import { ConnectionFlow, ConnectionReceiver } from "./connection-flow"

const catalogProductImage =
  "https://cdn.dsmcdn.com/ty1836/prod/QC_ENRICHMENT/20260312/17/d811e001-5412-3974-b203-c9d27e4ff135/1_org_zoom.jpg"

const workflowSteps = [
  {
    id: "connect",
    number: "01",
    label: "Bağlantı",
    title: "Mağazanız orada.\nKontrol merkezi burada.",
    description:
      "Trendyol ve Hepsiburada mağazalarınızı bağlayın. Farklı sekmelerde takip ettiğiniz ürünler ve sorular, aynı çalışma alanında buluşsun.",
    note: "Her mağazanın kataloğu, soruları ve kuralları kendine ait.",
  },
  {
    id: "catalog",
    number: "02",
    label: "Ürün bilgisi",
    title: "Her ürün,\nbütün bilgileriyle.",
    description:
      "Açıklamalar, renkler, bedenler, özellikler ve mevcut beden tabloları birlikte değerlendirilir. AI, yanıtlayacağı sorunun hangi ürüne ait olduğunu bilir.",
    note: "Pazaryeri verileri tek bir katalogda, düzenli olarak güncellenir.",
  },
  {
    id: "answer",
    number: "03",
    label: "Yanıt hazırlığı",
    title: "Soruyu anlar.\nBilgiyi yerine koyar.",
    description:
      "Müşterinin ne sorduğunu ürün bilgileriyle ilişkilendirir. Mağazanızın yanıt tonunu ve özel talimatlarını kullanarak gönderilmeye hazır bir taslak oluşturur.",
    note: "Stok sorularında pazaryerindeki güncel durum ayrıca kontrol edilir.",
  },
  {
    id: "decision",
    number: "04",
    label: "Gönderim kararı",
    title: "Akış otomatik.\nSon söz sizde.",
    description:
      "İsterseniz her taslağı kendiniz onaylayın. Otomatik gönderimi açtığınızda ise uygun yanıtlar gönderilsin, bilgi eksikliği olan sorular incelemenize bırakılsın.",
    note: "Yanıtın dayandığı bilgiyi ve gönderim durumunu her zaman görün.",
  },
] as const

const revealTransition = { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const }

export function WorkflowSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start center", "end center"],
  })

  return (
    <section
      id="workflow"
      aria-labelledby="workflow-title"
      className="relative scroll-mt-24 overflow-hidden bg-[#f7f8f4] px-5 py-24 sm:px-8 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-6 border-t border-[#182820]/15 pt-6 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-[#245d46] uppercase">
            <span className="size-1.5 rounded-full bg-[#245d46]" />
            Sorudan yanıta
          </p>
          <div>
            <h2
              id="workflow-title"
              className="max-w-xl text-[36px] leading-[1.08] font-semibold tracking-[-0.055em] text-[#182820] sm:text-[46px] lg:text-[56px]"
            >
              Arka planda çok şey olur.
              <span className="text-[#7c877f]">
                {" "}
                Size akışı yönetmek kalır.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#6b776f]">
              Bağlantıdan gönderime, bir ürün sorusunun Core Asistan içindeki
              yolculuğu.
            </p>
          </div>
        </div>

        <div ref={trackRef} className="relative mt-16 lg:mt-24">
          <div
            aria-hidden="true"
            className="absolute inset-y-7 left-3 w-px bg-[#dce2d9] lg:left-1/2"
          >
            <motion.div
              style={{ scaleY: reduceMotion ? 1 : scrollYProgress }}
              className="h-full w-px origin-top bg-[#427359]"
            />
          </div>
          {workflowSteps.map((step, index) => (
            <WorkflowStage key={step.id} step={step} index={index}>
              {step.id === "connect" && <ConnectionScene />}
              {step.id === "catalog" && <CatalogScene />}
              {step.id === "answer" && <AnswerScene />}
              {step.id === "decision" && <DecisionScene />}
            </WorkflowStage>
          ))}
        </div>
      </div>
    </section>
  )
}

function WorkflowStage({
  step,
  index,
  children,
}: {
  step: (typeof workflowSteps)[number]
  index: number
  children: ReactNode
}) {
  const rowRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const isReversed = index % 2 === 1
  const { scrollYProgress } = useScroll({
    target: rowRef,
    offset: ["start end", "end start"],
  })
  const visualY = useTransform(scrollYProgress, [0, 0.45, 1], [72, 0, -40])
  const visualScale = useTransform(
    scrollYProgress,
    [0, 0.4, 1],
    [0.94, 1, 0.98]
  )
  const visualRotate = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    isReversed ? [-4, 0, 1.5] : [4, 0, -1.5]
  )
  const markerScale = useTransform(
    scrollYProgress,
    [0, 0.28, 0.5],
    [0.72, 1, 1]
  )
  const markerOpacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0.1, 1, 1, 0.15]
  )
  const markerHalo = useTransform(
    scrollYProgress,
    [0, 0.4, 1],
    [0.8, 1.65, 1.2]
  )
  const connectorScale = useTransform(scrollYProgress, [0.12, 0.4], [0, 1])
  const stageFocus = useTransform(
    scrollYProgress,
    [0, 0.2, 0.48, 0.8, 1],
    [0.46, 0.76, 1, 0.76, 0.5]
  )
  const stageScale = useTransform(
    scrollYProgress,
    [0, 0.48, 1],
    [0.985, 1, 0.99]
  )
  const sceneFocus = useTransform(
    scrollYProgress,
    [0, 0.2, 0.48, 0.82, 1],
    [0.7, 0.9, 1, 0.9, 0.72]
  )
  const titleColor = useTransform(
    scrollYProgress,
    [0, 0.26, 0.48, 0.78, 1],
    ["#7b867e", "#34463b", "#182820", "#445249", "#7b867e"]
  )
  const accentColor = useTransform(
    scrollYProgress,
    [0, 0.26, 0.48, 0.78, 1],
    ["#87918a", "#4f765f", "#245d46", "#5f7d69", "#87918a"]
  )

  return (
    <article
      ref={rowRef}
      aria-labelledby={`workflow-${step.id}-title`}
      className="relative grid gap-7 pb-16 pl-10 last:pb-0 sm:pl-12 lg:min-h-[410px] lg:grid-cols-2 lg:items-center lg:gap-28 lg:pb-16 lg:pl-0"
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 hidden h-px w-10 -translate-y-8 bg-[#dce2d9] lg:block",
          isReversed ? "right-1/2" : "left-1/2"
        )}
      >
        <motion.div
          style={
            reduceMotion
              ? { scaleX: 1 }
              : { scaleX: connectorScale, opacity: stageFocus }
          }
          className={cn(
            "h-full bg-[#6e9468]",
            isReversed ? "origin-right" : "origin-left"
          )}
        />
      </div>
      <motion.span
        aria-hidden="true"
        style={
          reduceMotion
            ? { scale: 1 }
            : { scale: markerScale, opacity: stageFocus }
        }
        className="absolute top-2 left-0 flex size-6 items-center justify-center rounded-full border border-[#cad7c8] bg-[#f7f8f4] lg:top-1/2 lg:-left-3 lg:ml-[50%] lg:-translate-y-8"
      >
        <motion.span
          style={
            reduceMotion
              ? { opacity: 0 }
              : { scale: markerHalo, opacity: markerOpacity }
          }
          className="absolute inset-0 rounded-full border border-[#98b28b]/50 bg-[#e2edda]/50"
        />
        <span className="relative size-2 rounded-full bg-[#245d46]" />
      </motion.span>

      <motion.div
        style={
          reduceMotion ? undefined : { opacity: stageFocus, scale: stageScale }
        }
        className={cn(
          "max-w-md",
          isReversed && "lg:col-start-2 lg:row-start-1"
        )}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={revealTransition}
        >
          <p className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.13em] text-[#6a786d] uppercase">
            <motion.span
              style={reduceMotion ? undefined : { color: accentColor }}
            >
              {step.number}
            </motion.span>
            <span className="h-px w-6 bg-[#c6d0c3]" />
            {step.label}
          </p>
          <motion.h3
            id={`workflow-${step.id}-title`}
            style={reduceMotion ? undefined : { color: titleColor }}
            className="mt-4 text-[29px] leading-[1.14] font-semibold tracking-[-0.045em] whitespace-pre-line text-[#182820] sm:text-[35px] lg:text-[39px]"
          >
            {step.title}
          </motion.h3>
          <p className="mt-5 max-w-sm text-[14px] leading-7 text-[#6b776f]">
            {step.description}
          </p>
          <p className="mt-6 flex max-w-sm items-start gap-2.5 text-[11px] leading-5 text-[#476451]">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              className="mt-0.5 size-3.5 shrink-0"
            />
            {step.note}
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        style={
          reduceMotion
            ? undefined
            : {
                y: visualY,
                rotate: visualRotate,
                scale: visualScale,
                opacity: sceneFocus,
              }
        }
        className={cn(
          "min-w-0 py-2 lg:py-5",
          isReversed && "lg:col-start-1 lg:row-start-1"
        )}
      >
        <WorkflowProgressContext.Provider value={scrollYProgress}>
          {children}
        </WorkflowProgressContext.Provider>
      </motion.div>
    </article>
  )
}

function SceneCaption({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 text-[9px] font-medium tracking-[0.04em] text-[#829084]">
      <span>{children}</span>
      <span className="rounded-full border border-[#d9dfd5] px-2 py-0.5 text-[8px]">
        Örnek
      </span>
    </div>
  )
}

function ConnectionScene() {
  return (
    <div className="relative py-3 sm:px-2">
      <SceneCaption>Tek çalışma alanı · İki pazaryeri</SceneCaption>
      <div className="relative flex items-center justify-between gap-3 py-7">
        <div className="relative z-10 flex w-[54%] flex-col gap-5">
          {[
            { id: "trendyol", name: "Trendyol" },
            { id: "hepsiburada", name: "Hepsiburada" },
          ].map((provider, index) => (
            <WorkflowReveal
              key={provider.id}
              at={0.1 + index * 0.08}
              className="flex items-center gap-2.5 rounded-xl border border-[#dfe5db] bg-white p-3 shadow-[0_6px_20px_-12px_#18282040] sm:gap-3 sm:p-4"
            >
              <ProviderLogo
                provider={provider.id}
                className="size-9 rounded-lg border-[#e8ebe4] shadow-none sm:size-10"
                sizes="40px"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#263a2d] sm:text-xs">
                  {provider.name}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[8px] text-[#68826d] sm:text-[9px]">
                  <span className="size-1 rounded-full bg-[#558160]" />
                  Mağaza bağlandı
                </p>
              </div>
            </WorkflowReveal>
          ))}
        </div>

        <ConnectionFlow />

        <div className="relative z-10 flex w-[32%] flex-col items-center">
          <ConnectionReceiver />
          <div className="flex size-20 items-center justify-center rounded-[23px] bg-[#245d46] text-white shadow-[0_12px_25px_-10px_#245d4670] sm:size-24">
            <HugeiconsIcon icon={Link01Icon} className="size-8 sm:size-10" />
          </div>
          <p className="mt-3 text-xs font-semibold tracking-[-0.03em] text-[#182820]">
            Core Asistan
          </p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 border-t border-[#dce3d7] pt-4 text-[10px] text-[#677961]">
        <HugeiconsIcon icon={Database01Icon} className="size-3.5" />
        Ürünler ve sorular aynı yere akıyor.
      </div>
    </div>
  )
}

function CatalogScene() {
  const attributes = [
    { id: "fabric", label: "Kumaş", value: "Pamuklu" },
    { id: "fit", label: "Kalıp", value: "Slim fit" },
    { id: "color", label: "Renk", value: "Siyah" },
    { id: "size-guide", label: "Beden tablosu", value: "Katalogda mevcut" },
  ]

  return (
    <div className="relative rounded-[24px] bg-[#e8edde] p-4 sm:p-6">
      <SceneCaption>Bir ürünün bilgi haritası</SceneCaption>
      <div className="flex items-start gap-3.5 sm:gap-5">
        <div className="w-[36%] shrink-0">
          <WorkflowReveal
            at={0.1}
            className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f7f8f1]"
          >
            <Image
              src={catalogProductImage}
              alt="DeFacto siyah slim fit polo yaka tişört"
              fill
              sizes="(min-width: 1024px) 180px, (min-width: 640px) 240px, 120px"
              className="object-cover"
            />
          </WorkflowReveal>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["S", "M", "L", "XL"].map((size) => (
              <span
                key={size}
                className="flex size-6 items-center justify-center rounded-md bg-white/80 text-[8px] font-medium text-[#536249]"
              >
                {size}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-5 font-semibold text-[#293c2f] sm:text-sm">
            Slim Fit Polo Yaka Pamuklu Tişört
          </p>
          <p className="mt-1 text-[9px] text-[#7d8b76]">
            Ürün ve varyant bilgileri
          </p>
          <dl className="mt-4 divide-y divide-[#ced8c4]">
            {attributes.map((attribute, index) => (
              <WorkflowReveal
                key={attribute.id}
                at={0.18 + index * 0.035}
                distance={10}
                className="py-2.5 first:pt-0"
              >
                <dt className="text-[8px] text-[#7c8a74]">{attribute.label}</dt>
                <dd className="mt-0.5 text-[10px] font-medium text-[#3b513d]">
                  {attribute.value}
                </dd>
              </WorkflowReveal>
            ))}
          </dl>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg bg-[#d6e2c6] px-3 py-2.5 text-[9px] font-medium text-[#4c6842]">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="size-3.5 shrink-0"
        />
        Soru, ilgili ürünün bilgileriyle eşleştirildi
      </div>
    </div>
  )
}

function AnswerScene() {
  return (
    <div className="py-2">
      <SceneCaption>Soru, kaynak ve yanıt</SceneCaption>
      <WorkflowReveal
        at={0.1}
        className="ml-6 rounded-[18px] rounded-br-sm border border-[#dce3d6] bg-white p-4 shadow-[0_8px_22px_-14px_#18282030] sm:ml-14"
      >
        <div className="mb-2.5 flex items-center gap-2 text-[9px] text-[#81907f]">
          <ProviderLogo
            provider="trendyol"
            className="size-5 rounded-md shadow-none"
            sizes="20px"
          />
          Gelen ürün sorusu
        </div>
        <p className="text-[14px] font-medium text-[#263a2d]">
          “Siyah XL stokta var mı?”
        </p>
      </WorkflowReveal>
      <WorkflowReveal
        at={0.2}
        className="my-4 flex flex-wrap items-center justify-center gap-1.5 px-1"
      >
        {[
          { id: "product-match", text: "Ürün eşleşti" },
          { id: "variant-match", text: "Siyah · XL" },
          { id: "inventory-check", text: "Stok doğrulandı" },
        ].map((source) => (
          <span
            key={source.id}
            className="flex items-center gap-1 rounded-full border border-[#dce4d4] px-2 py-1.5 text-[8px] font-medium text-[#6f8365]"
          >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-2.5" />
            {source.text}
          </span>
        ))}
      </WorkflowReveal>
      <WorkflowReveal
        at={0.3}
        className="mr-4 rounded-[18px] rounded-bl-sm bg-[#245d46] p-5 text-white sm:mr-8 sm:p-6"
      >
        <div className="flex items-center justify-between text-[9px] text-[#bdd4c6]">
          <span className="font-semibold tracking-[0.03em]">Core Asistan</span>
          <span>Yanıt taslağı</span>
        </div>
        <p className="mt-3 text-[13px] leading-6 text-[#eef5ef] sm:text-sm">
          Merhabalar, siyah XL seçeneğimiz şu anda stokta mevcut. Keyifli
          alışverişler dileriz.
        </p>
        <div className="mt-4 flex items-center gap-2 border-t border-white/15 pt-3 text-[9px] text-[#c8ddb5]">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
          Güncel stok bilgisiyle desteklendi
        </div>
      </WorkflowReveal>
    </div>
  )
}

function DecisionScene() {
  return (
    <div className="py-3">
      <SceneCaption>Otomatik gönderim açıkken</SceneCaption>
      <div className="flex items-center gap-3 border-b border-[#dce2d5] pb-5">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#e5ebdc] text-[#416043]">
          <HugeiconsIcon icon={Shield01Icon} className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[#263b2b]">
            Her yanıt ayrı değerlendirilir.
          </p>
          <p className="mt-1 text-[10px] text-[#82907b]">
            Kanıt, güncellik ve mağaza kuralları
          </p>
        </div>
      </div>
      <div className="relative ml-5 border-l border-[#d3ddc9] py-5 pl-5 sm:pl-7">
        <div className="absolute top-12 left-0 h-px w-5 bg-[#d3ddc9] sm:w-7" />
        <WorkflowReveal
          at={0.18}
          className="rounded-[16px] bg-[#d9eeae] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#3d5629]">
              Bilgi doğrulandı
            </p>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-3.5 text-[#61853f]"
            />
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#62784b]">
            “Siyah XL stokta var mı?”
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold text-[#456b2d]">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
            Otomatik gönderildi
          </p>
        </WorkflowReveal>
        <div className="absolute bottom-20 left-0 h-px w-5 bg-[#d3ddc9] sm:w-7" />
        <WorkflowReveal
          at={0.29}
          className="mt-3 rounded-[16px] border border-[#e2ddd0] bg-[#fbf7ee] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-[#71634a]">
              Bilgi eksik
            </p>
            <span className="size-1.5 rounded-full bg-[#c4a463]" />
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#978770]">
            “Yıkamada rengi solar mı?”
          </p>
          <p className="mt-3 text-[9px] font-semibold text-[#a08045]">
            İncelemeniz bekleniyor
          </p>
        </WorkflowReveal>
      </div>
    </div>
  )
}
