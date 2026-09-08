"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { QuestionDemo } from "@/components/landing/question-demo"
import { BILLING_TRIAL } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import styles from "./landing.module.css"

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })
  const textY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const textOpacity = useTransform(scrollYProgress, [0, 0.65, 1], [1, 1, 0.15])

  return (
    <section
      ref={sectionRef}
      className={styles.hero}
      aria-labelledby="hero-title"
    >
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          <motion.div
            style={
              reduceMotion ? undefined : { y: textY, opacity: textOpacity }
            }
            className="relative z-10 min-w-0 pb-6 lg:pb-10"
          >
            <p className={`${styles.eyebrow} mb-7 text-[#47715a]`}>
              Pazaryeri soruları, artık daha kolay
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className="block">Sorular aksın.</span>
              <span className="block">Cevaplar</span>
              <span className={`${styles.heroAccent} text-[#245d46]`}>
                yerini bulsun.
              </span>
            </h1>
            <p className="mt-8 max-w-[440px] text-[15px] leading-[1.8] text-[#68736b] sm:text-base">
              Trendyol ve Hepsiburada sorularını ürünlerinizi tanıyan AI
              yanıtlasın. Güncel bilgiyle, mağazanızın diliyle, sizin
              kontrolünüzde.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-5">
              <Link href={APP_ROUTES.login} className={styles.primaryLink}>
                Ücretsiz deneyin
                <span className={styles.linkArrow}>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </span>
              </Link>
              <a
                href="#workflow"
                className="group inline-flex items-center gap-2 border-b border-[#b6c1b2] pb-1 text-[13px] font-medium transition-[color,transform] active:translate-y-0.5 active:text-[#245d46]"
              >
                Akışı keşfedin
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className="size-3.5 transition-transform group-hover:translate-y-0.5 group-active:translate-y-1"
                />
              </a>
            </div>
            <p className="mt-4 text-xs text-[#7b867b]">
              Kart gerektirmeden {BILLING_TRIAL.days} gün ücretsiz deneme
            </p>
          </motion.div>
          <div className="relative min-w-0">
            <QuestionDemo />
          </div>
        </div>
        <div className={styles.heroFoot}>
          <p className="max-w-[220px] text-xs leading-5 text-[#778171]">
            İki pazaryeri. Tek gelen kutusu.
            <br />
            <span className="text-[#233d2d]">
              Mağazanız için ortak bir hafıza.
            </span>
          </p>
          <div className="flex items-center gap-5 sm:gap-8">
            {[
              { id: "trendyol", label: "Trendyol" },
              { id: "hepsiburada", label: "Hepsiburada" },
            ].map((provider) => (
              <div key={provider.id} className="flex items-center gap-2.5">
                <ProviderLogo
                  provider={provider.id}
                  className="size-9 rounded-lg border-0 shadow-none"
                  sizes="36px"
                />
                <span className="text-sm font-semibold tracking-tight">
                  {provider.label}
                </span>
              </div>
            ))}
          </div>
          <span className="hidden items-center gap-3 text-[11px] text-[#71806c] lg:flex">
            Sorudan yanıta, birlikte ilerleyelim{" "}
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
          </span>
        </div>
      </div>
    </section>
  )
}
