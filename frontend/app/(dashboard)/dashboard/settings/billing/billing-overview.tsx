"use client"

import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  Calendar03Icon,
  CheckmarkCircle01Icon,
  CreditCardIcon,
  Crown03Icon,
  Invoice03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SubscriptionUsage } from "@/components/dashboard/billing/subscription-usage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"

const planFeatures = [
  "Aylık 5.000 ürün sorusu",
  "5 mağaza ve 10 pazaryeri bağlantısı",
  "25.000 ürüne kadar katalog",
  "Gelişmiş yanıt ve marka ayarları",
  "Öncelikli destek",
] as const

export function BillingOverview() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">
            Abonelik
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Planınızı, kullanım haklarınızı ve yenileme bilgilerinizi tek yerden
            yönetin.
          </p>
        </div>
        <Badge variant="success" className="w-fit px-3 py-1">
          <span className="size-1.5 rounded-full bg-current" />
          Abonelik aktif
        </Badge>
      </header>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                <HugeiconsIcon icon={Crown03Icon} className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Mevcut plan
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                  Growth
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Büyüyen e-ticaret operasyonları için
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-3xl font-semibold tracking-[-0.04em]">
                6.000 ₺
                <span className="ml-1 text-sm font-normal tracking-normal text-muted-foreground">
                  / ay
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                KDV hariç · aylık faturalandırma
              </p>
            </div>
          </div>

          <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={APP_ROUTES.dashboard.settings.plans}>
                  Planı değiştir
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={APP_ROUTES.dashboard.settings.invoices}>
                  Faturaları görüntüle
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Link>
              </Button>
            </div>
            <CancelSubscriptionDialog />
          </div>
        </div>

        <dl className="grid border-t border-border sm:grid-cols-3">
          <PlanMeta
            icon={Calendar03Icon}
            label="Sonraki yenileme"
            value="15 Eylül 2026"
          />
          <PlanMeta
            icon={Invoice03Icon}
            label="Faturalama dönemi"
            value="Aylık"
          />
          <PlanMeta
            icon={CreditCardIcon}
            label="Ödeme yöntemi"
            value="•••• 4242"
          />
        </dl>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.72fr)]">
        <SubscriptionUsage />

        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-[-0.015em]">
                Plan kapsamı
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Growth planına dahil olanlar
              </p>
            </div>
            <Badge variant="secondary">Growth</Badge>
          </div>

          <ul className="mt-5 space-y-3.5">
            {planFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm leading-5 text-foreground"
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs leading-5 text-muted-foreground">
              Kullanım limitleri her faturalama döneminin başında otomatik
              olarak yenilenir.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function PlanMeta({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 not-last:border-b not-last:border-border sm:px-6 sm:not-last:border-r sm:not-last:border-b-0">
      <HugeiconsIcon icon={icon} className="size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

function CancelSubscriptionDialog() {
  return (
    <ResponsiveDialog
      title="Aboneliği iptal etmek istiyor musunuz?"
      description="Planınız 15 Eylül 2026 tarihine kadar aktif kalır ve bu tarihte yenilenmez."
      contentClassName="sm:max-w-lg"
      trigger={
        <Button variant="outline" className="text-destructive">
          Aboneliği iptal et
        </Button>
      }
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" onClick={close}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" onClick={close}>
            Evet, aboneliği iptal et
          </Button>
        </>
      )}
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div>
          <p className="text-sm font-medium">
            Dönem sonunda erişiminiz değişir
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            AI taslağı oluşturma ve kanal senkronizasyonu durur. Mevcut
            verileriniz hesabınızda korunur; yeniden abone olduğunuzda
            kaldığınız yerden devam edebilirsiniz.
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
