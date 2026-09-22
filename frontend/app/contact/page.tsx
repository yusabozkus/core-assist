import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ContactForm } from "@/components/contact/contact-form"
import { LandingBrand } from "@/components/landing/landing-brand"
import { APP_ROUTES } from "@/constants/site"

export const metadata: Metadata = {
  title: "İletişim | Core Asistan",
  description:
    "Core Asistan ürün özellikleri, planları ve iş ortaklıkları hakkında ekibimizle iletişime geçin.",
}

export default function ContactPage() {
  return (
    <div className="min-h-svh bg-[#f6f8f3] text-[#17281f]">
      <header className="border-b border-[#dfe5da] bg-[#f9fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <LandingBrand />
          <div className="flex items-center gap-3">
            <Link
              href={APP_ROUTES.home}
              className="hidden items-center gap-2 text-xs font-semibold text-[#66736a] hover:text-[#245d46] sm:flex"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
              Ana sayfa
            </Link>
            <Link
              href={APP_ROUTES.login}
              className="inline-flex h-9 items-center rounded-lg border border-[#d7dfd3] bg-white px-3.5 text-xs font-semibold shadow-sm transition-colors hover:border-[#b7c8b9] hover:text-[#245d46]"
            >
              Giriş yap
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-20">
        <section className="lg:pt-8">
          <p className="text-xs font-semibold tracking-[0.13em] text-[#52705e] uppercase">
            Bizimle iletişime geçin
          </p>
          <h1 className="mt-5 max-w-md text-4xl leading-[1.05] font-semibold tracking-[-0.055em] sm:text-5xl">
            Sorunuzu doğru kişiye ulaştıralım.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-[#68756b]">
            Ürün özellikleri, plan seçimi veya olası bir iş ortaklığı hakkında
            bize yazın. Mesajınız doğrudan Core Asistan ekibinin yönetim
            paneline ulaşır.
          </p>

          <div className="mt-10 space-y-5 border-t border-[#dfe5da] pt-7">
            <ContactFact
              icon={Mail01Icon}
              title="Doğrudan ekibimize ulaşır"
              description="Mesajınız genel bir posta kutusunda kaybolmaz."
            />
            <ContactFact
              icon={Clock01Icon}
              title="İhtiyacınızla birlikte incelenir"
              description="Konu seçiminiz mesajın doğru bağlamda değerlendirilmesini sağlar."
            />
            <ContactFact
              icon={CheckmarkCircle02Icon}
              title="Hesap açmanız gerekmez"
              description="Ürünü kullanmadan önce de tüm sorularınızı paylaşabilirsiniz."
            />
          </div>
        </section>

        <section className="rounded-3xl border border-[#dbe3d7] bg-[#fbfcfa] p-5 shadow-[0_24px_70px_-44px_rgba(23,40,31,0.3)] sm:p-8 lg:p-9">
          <div className="mb-7">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Mesajınızı paylaşın
            </h2>
            <p className="mt-2 text-sm text-[#748077]">
              Size dönüş yapabilmemiz için bilgileri eksiksiz doldurun.
            </p>
          </div>
          <ContactForm />
        </section>
      </main>
    </div>
  )
}

function ContactFact({
  icon,
  title,
  description,
}: {
  icon: typeof Mail01Icon
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e9efe4] text-[#315d47]">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#7c887e]">{description}</p>
      </div>
    </div>
  )
}
