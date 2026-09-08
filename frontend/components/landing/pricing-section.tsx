"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ANNUAL_DISCOUNT_RATE,
  BILLING_TRIAL,
  INCLUDED_MARKETPLACES,
  SUBSCRIPTION_PLANS,
} from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import { formatCurrency } from "@/lib/format-currency"
import { cn } from "@/lib/utils"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const formatPlanPrice = (value: number) =>
  formatCurrency(value, "TRY", { maximumFractionDigits: 0 })

type BillingCycle = "monthly" | "annual"

function BillingCycleToggle({
  value,
  onChange,
}: {
  value: BillingCycle
  onChange: (value: BillingCycle) => void
}) {
  const annual = value === "annual"
  const reduceMotion = useReducedMotion()

  return (
    <div
      className="relative grid w-[238px] grid-cols-2 rounded-full border border-[#dce3d3] bg-white p-1 shadow-[0_1px_2px_rgba(23,40,31,0.04)]"
      role="group"
      aria-label="Faturalama dönemi"
    >
      <motion.span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#243d2c] shadow-[0_5px_14px_rgba(36,61,44,0.18)]"
        animate={{ x: annual ? "100%" : "0%" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 410, damping: 34, mass: 0.72 }
        }
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        aria-pressed={!annual}
        className={cn(
          "relative z-10 rounded-full px-3 py-2.5 text-xs font-medium transition-[color,transform] duration-300 active:scale-[0.96]",
          !annual ? "text-white" : "text-[#78836c]"
        )}
      >
        Aylık
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        aria-pressed={annual}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium transition-[color,transform] duration-300 active:scale-[0.96]",
          annual ? "text-white" : "text-[#78836c]"
        )}
      >
        Yıllık
        <motion.span
          animate={
            annual && !reduceMotion
              ? { opacity: [0.72, 1, 1], scale: [0.9, 1.13, 1], y: [1, -1, 0] }
              : { opacity: 1, scale: 1, y: 0 }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors duration-300",
            annual
              ? "bg-white/14 text-[#e0f0c8]"
              : "bg-[#eaf2dc] text-[#648142]"
          )}
        >
          −%10
        </motion.span>
      </button>
    </div>
  )
}

function AnimatedPrice({
  value,
  cycle,
}: {
  value: string
  cycle: BillingCycle
}) {
  const reduceMotion = useReducedMotion()

  return (
    <span className="relative inline-grid overflow-hidden pb-[0.08em] leading-none">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={cycle}
          aria-hidden="true"
          className="[grid-area:1/1]"
          initial={reduceMotion ? { opacity: 1 } : { y: "-82%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "82%", opacity: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function AnimatedBillingNote({
  cycle,
  children,
}: {
  cycle: BillingCycle
  children: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <span className="relative inline-grid overflow-hidden align-top">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={cycle}
          className="[grid-area:1/1]"
          initial={reduceMotion ? { opacity: 1 } : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: 10, opacity: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const annual = billingCycle === "annual"

  return (
    <section
      id="pricing"
      className="border-y border-[#e0e6d8] bg-[#f0f3eb] py-20 sm:py-28"
    >
      <div className={styles.container}>
        <LandingReveal className="mb-12 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-[560px]">
            <p className={`${styles.eyebrow} mb-5 text-[#667e55]`}>
              İşiniz kadar, ihtiyacınız kadar
            </p>
            <h2 className={styles.sectionTitle}>
              Küçük başlayın.
              <br />
              Birlikte büyüyelim.
            </h2>
            <p className="mt-5 text-sm text-[#76816b]">
              Kart gerektirmeden {BILLING_TRIAL.days} gün ücretsiz deneyin.
            </p>
          </div>
          <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
        </LandingReveal>
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan, index) => (
            <LandingReveal
              key={plan.id}
              delay={index * 0.06}
              className="h-full"
            >
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-6 sm:p-8",
                  "transition-[transform,border-color,box-shadow] duration-300 ease-out active:scale-[0.995] motion-safe:hover:-translate-y-1",
                  plan.highlighted
                    ? "border-[#97b575] bg-[#e2efcd] hover:border-[#789c58] hover:shadow-[0_22px_46px_-32px_rgba(36,93,70,0.45)]"
                    : "border-[#dde4d5] bg-white hover:border-[#b7c7ac] hover:shadow-[0_22px_46px_-32px_rgba(23,40,31,0.34)]"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-medium tracking-[-.035em]">
                    {plan.name}
                  </h3>
                  {plan.highlighted && (
                    <span className="rounded-full border border-[#b8cd9b] px-2 py-1 text-[10px] text-[#658049]">
                      Büyüyen ekipler için
                    </span>
                  )}
                </div>
                <p className="mt-3 min-h-10 max-w-[220px] text-xs leading-5 text-[#78846a]">
                  {plan.description}
                </p>
                <div
                  className="mt-8 flex items-baseline gap-2"
                  aria-live="polite"
                >
                  <span className="text-[42px] font-medium tracking-[-.07em] tabular-nums">
                    <AnimatedPrice
                      cycle={billingCycle}
                      value={formatPlanPrice(
                        plan.monthlyPrice *
                          (annual ? 1 - ANNUAL_DISCOUNT_RATE : 1)
                      )}
                    />
                    <span className="sr-only">
                      {formatPlanPrice(
                        plan.monthlyPrice *
                          (annual ? 1 - ANNUAL_DISCOUNT_RATE : 1)
                      )}
                    </span>
                  </span>
                  <span className="text-xs text-[#879476]">/ ay</span>
                </div>
                <p className="mt-2 min-h-5 text-[11px] text-[#829071]">
                  <AnimatedBillingNote cycle={billingCycle}>
                    {annual
                      ? `Yıllık ${formatPlanPrice(plan.monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT_RATE))} olarak ödenir`
                      : "Aylık faturalandırılır"}
                  </AnimatedBillingNote>
                </p>
                <Link
                  href={APP_ROUTES.login}
                  className={cn(
                    "group mt-7 flex h-11 items-center justify-between rounded-full px-5 text-xs font-medium transition-[background-color,transform] active:scale-[0.98]",
                    plan.highlighted
                      ? "bg-[#243e2b] text-white hover:bg-[#32563a]"
                      : "border border-[#dde5d2] hover:bg-[#f2f6eb]"
                  )}
                >
                  Ücretsiz deneyin{" "}
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-active:translate-x-1"
                  />
                </Link>
                <div className="mt-7 border-t border-[#c7d7b8]/60 pt-6">
                  <p className="text-sm font-medium">
                    Ayda {plan.questions.toLocaleString("tr-TR")} ürün sorusu
                  </p>
                  <ul className="mt-5 space-y-3.5">
                    {[
                      {
                        id: "stores",
                        text: `${plan.stores} mağaza · ${plan.members} kullanıcı`,
                      },
                      {
                        id: "marketplaces",
                        text: INCLUDED_MARKETPLACES,
                      },
                      {
                        id: "catalog",
                        text: `${plan.products.toLocaleString("tr-TR")} aktif ürüne kadar`,
                      },
                      {
                        id: "automation",
                        text: "AI taslakları ve güvenli otomatik gönderim",
                      },
                      {
                        id: "analytics",
                        text: "AI performansı ve güven analizleri",
                      },
                      {
                        id: "support",
                        text: plan.support,
                      },
                    ].map((feature) => (
                      <li
                        key={feature.id}
                        className="flex items-center gap-2.5 text-xs text-[#667858]"
                      >
                        <HugeiconsIcon
                          icon={CheckmarkCircle01Icon}
                          className="size-3.5 shrink-0"
                        />
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </LandingReveal>
          ))}
        </div>
        <p className="mt-6 text-xs leading-5 text-[#8a957e]">
          Vergiler ödeme adresine göre hesaplanır. Yıllık planlarda aylık
          fiyatın 12 katına %10 indirim uygulanır.
        </p>
      </div>
    </section>
  )
}
