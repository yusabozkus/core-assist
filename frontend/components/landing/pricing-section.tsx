"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const plans = [
  {
    id: "starter",
    name: "Başlangıç",
    price: 2300,
    description: "İlk otomasyonunu kuran mağazalar için.",
    questions: "1.500",
    stores: "1 mağaza",
    connections: "2 pazaryeri bağlantısı",
    catalog: "5.000 ürüne kadar katalog",
    featured: false,
  },
  {
    id: "growth",
    name: "Büyüme",
    price: 6000,
    description: "Birden fazla mağazayı yöneten ekipler için.",
    questions: "5.000",
    stores: "5 mağaza",
    connections: "10 pazaryeri bağlantısı",
    catalog: "25.000 ürüne kadar katalog",
    featured: true,
  },
  {
    id: "business",
    name: "Ölçek",
    price: 10000,
    description: "Yüksek soru hacmine sahip operasyonlar için.",
    questions: "15.000",
    stores: "15 mağaza",
    connections: "Sınırsız pazaryeri bağlantısı",
    catalog: "100.000 ürüne kadar katalog",
    featured: false,
  },
]
const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  )
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
              Her planda 7 gün ücretsiz deneme.
            </p>
          </div>
          <div
            className="inline-flex w-fit items-center gap-1 rounded-full border border-[#dce3d3] bg-white p-1"
            role="group"
            aria-label="Faturalama dönemi"
          >
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              aria-pressed={!annual}
              className={cn(
                "rounded-full px-5 py-2.5 text-xs transition-colors",
                !annual ? "bg-[#243d2c] text-white" : "text-[#78836c]"
              )}
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              aria-pressed={annual}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-xs transition-colors",
                annual ? "bg-[#243d2c] text-white" : "text-[#78836c]"
              )}
            >
              Yıllık{" "}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  annual
                    ? "bg-white/15 text-[#e0f0c8]"
                    : "bg-[#eaf2dc] text-[#648142]"
                )}
              >
                −%10
              </span>
            </button>
          </div>
        </LandingReveal>
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <LandingReveal
              key={plan.id}
              delay={index * 0.06}
              className="h-full"
            >
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-6 sm:p-8",
                  plan.featured
                    ? "border-[#97b575] bg-[#e2efcd]"
                    : "border-[#dde4d5] bg-white"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-medium tracking-[-.035em]">
                    {plan.name}
                  </h3>
                  {plan.featured && (
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
                    {currency.format(plan.price * (annual ? 0.9 : 1))}
                  </span>
                  <span className="text-xs text-[#879476]">/ ay</span>
                </div>
                <p className="mt-2 min-h-5 text-[11px] text-[#829071]">
                  {annual
                    ? `Yıllık ${currency.format(plan.price * 12 * 0.9)} olarak ödenir`
                    : "Aylık faturalandırılır"}
                </p>
                <Link
                  href={APP_ROUTES.login}
                  className={cn(
                    "mt-7 flex h-11 items-center justify-between rounded-full px-5 text-xs font-medium transition-colors",
                    plan.featured
                      ? "bg-[#243e2b] text-white hover:bg-[#32563a]"
                      : "border border-[#dde5d2] hover:bg-[#f2f6eb]"
                  )}
                >
                  Ücretsiz deneyin{" "}
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Link>
                <div className="mt-7 border-t border-[#c7d7b8]/60 pt-6">
                  <p className="text-sm font-medium">
                    Ayda {plan.questions} ürün sorusu
                  </p>
                  <ul className="mt-5 space-y-3.5">
                    {[
                      { id: "stores", text: plan.stores },
                      { id: "connections", text: plan.connections },
                      { id: "catalog", text: plan.catalog },
                      {
                        id: "automation",
                        text: "AI taslakları ve güvenli otomasyon",
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
          Fiyatlara KDV dahil değildir. Yıllık planlarda aylık fiyatın 12 katına
          %10 indirim uygulanır.
        </p>
      </div>
    </section>
  )
}
