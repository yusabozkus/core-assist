"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarCheck01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  CreditCardIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  getPlanPrice,
  PlanCard,
  type BillingCycle,
  type SubscriptionPlan,
} from "@/components/dashboard/billing/plan-card"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

const plans: readonly SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Yeni başlayan ve düşük hacimli satış yapan mağazalar için.",
    monthlyPrice: 2300,
    features: [
      "Aylık 1.500 ürün sorusu",
      "1 mağaza",
      "2 pazaryeri bağlantısı",
      "5.000 ürüne kadar katalog",
      "Temel yanıt davranışı ayarları",
      "E-posta desteği",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "Büyüyen ve birden fazla kanalı yöneten operasyonlar için.",
    monthlyPrice: 6000,
    highlighted: true,
    current: true,
    features: [
      "Aylık 5.000 ürün sorusu",
      "5 mağaza",
      "10 pazaryeri bağlantısı",
      "25.000 ürüne kadar katalog",
      "Gelişmiş yanıt ve marka ayarları",
      "Öncelikli destek",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Yüksek hacimli ve çok mağazalı satış ekipleri için.",
    monthlyPrice: 10000,
    features: [
      "Aylık 15.000 ürün sorusu",
      "15 mağaza",
      "Sınırsız pazaryeri bağlantısı",
      "100.000 ürüne kadar katalog",
      "Gelişmiş AI kuralları ve analizler",
      "Öncelikli destek ve hızlı dönüş",
    ],
  },
] as const

export function PlansClient() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null
  )

  return (
    <main className="themed-scrollbar fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="sticky top-0 z-20 border-b border-border/75 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-17 w-full max-w-[1440px] items-center justify-between px-5 sm:h-19 sm:px-8 lg:px-10">
          <AppLogo />
          <Button
            asChild
            variant="outline"
            size="icon"
            className="rounded-full bg-card shadow-xs"
          >
            <Link
              href={APP_ROUTES.dashboard.settings.billing}
              aria-label="Planlar sayfasını kapat"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-5 py-9 sm:px-8 sm:py-12 lg:px-10">
        <header className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="bg-card px-3 py-1 shadow-xs">
            <HugeiconsIcon icon={CalendarCheck01Icon} className="size-3.5" />
            Tüm planlarda 7 gün ücretsiz
          </Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-4xl">
            İşletmenize uygun planı seçin
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            İhtiyacınız değiştikçe planınızı yükseltebilir veya
            düşürebilirsiniz. İlk aboneliğinizde 7 gün boyunca ücretsiz deneyin.
          </p>
        </header>

        <div className="mt-8 flex justify-center">
          <div
            className="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-xs"
            aria-label="Faturalama dönemi"
          >
            <CycleButton
              active={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
            >
              Aylık
            </CycleButton>
            <CycleButton
              active={billingCycle === "annual"}
              onClick={() => setBillingCycle("annual")}
            >
              Yıllık
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  billingCycle === "annual"
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                )}
              >
                %10 indirim
              </span>
            </CycleButton>
          </div>
        </div>

        <section className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              onSelect={setSelectedPlan}
            />
          ))}
        </section>

        <section className="mt-8 grid border-y border-border py-6 sm:grid-cols-3">
          <PlanAssurance
            icon={CalendarCheck01Icon}
            title="7 gün ücretsiz deneyin"
            description="İlk ücret deneme süreniz tamamlandığında alınır."
          />
          <PlanAssurance
            icon={RefreshIcon}
            title="Planınızı dilediğiniz zaman değiştirin"
            description="İhtiyacınız arttığında veya azaldığında planınızı güncelleyin."
          />
          <PlanAssurance
            icon={CheckmarkCircle01Icon}
            title="İstediğiniz zaman iptal edin"
            description="Taahhüt yoktur; planınız dönem sonuna kadar devam eder."
          />
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          Gösterilen fiyatlara KDV dahil değildir. Yıllık planlar tek seferde
          faturalandırılır.
        </p>

        <PlanSelectionDialog
          plan={selectedPlan}
          billingCycle={billingCycle}
          onOpenChange={(open) => {
            if (!open) setSelectedPlan(null)
          }}
        />
      </div>
    </main>
  )
}

function CycleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function PlanAssurance({
  icon,
  title,
  description,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 px-0 py-4 not-last:border-b not-last:border-border sm:px-6 sm:py-0 sm:not-last:border-r sm:not-last:border-b-0 sm:first:pl-0 sm:last:pr-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  )
}

function PlanSelectionDialog({
  plan,
  billingCycle,
  onOpenChange,
}: {
  plan: SubscriptionPlan | null
  billingCycle: BillingCycle
  onOpenChange: (open: boolean) => void
}) {
  const price = plan ? getPlanPrice(plan, billingCycle) : null

  return (
    <ResponsiveDialog
      open={plan !== null}
      onOpenChange={onOpenChange}
      title={plan ? `${plan.name} planını ücretsiz deneyin` : "Plan seçimi"}
      description="7 günlük deneme sürenizin ardından seçtiğiniz faturalama dönemi başlar."
      contentClassName="sm:max-w-lg"
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" onClick={close}>
            Vazgeç
          </Button>
          <Button type="button" onClick={close}>
            7 günlük denemeyi başlat
          </Button>
        </>
      )}
    >
      {plan && price ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/35 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Seçilen plan
              </p>
              <p className="mt-1 font-semibold">{plan.name}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{price.monthly} / ay</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {billingCycle === "annual" ? "Yıllık ödeme" : "Aylık ödeme"}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-border text-sm">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <dt className="text-muted-foreground">Bugün ödenecek</dt>
              <dd className="font-semibold">0 ₺</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Deneme bitişi</dt>
              <dd className="font-medium">9 Eylül 2026</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <dt className="text-muted-foreground">Sonraki ödeme</dt>
              <dd className="font-medium">{price.billed}</dd>
            </div>
          </dl>

          <div className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <HugeiconsIcon
              icon={CreditCardIcon}
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            Deneme süreniz bitmeden iptal ederseniz ücretlendirilmezsiniz.
          </div>
        </div>
      ) : null}
    </ResponsiveDialog>
  )
}
