import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { BILLING_TRIAL } from "@/constants/billing"
import { LANDING_NAVIGATION } from "@/constants/landing"
import { APP_ROUTES } from "@/constants/site"
import { FooterWordmark } from "./footer-wordmark"
import { LandingBrand } from "./landing-brand"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

export function LandingFooter() {
  return (
    <footer className="overflow-hidden border-t border-[#d6dfcc] bg-[#eef3e7] pt-16 sm:pt-24">
      <div className={styles.container}>
        <LandingReveal className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className={`${styles.eyebrow} mb-5 text-[#6d845c]`}>
              Bir sonraki soruya hazırsınız.
            </p>
            <h2 className="max-w-[650px] text-[38px] leading-[1.08] font-medium tracking-[-.055em] sm:text-[58px]">
              Mağazanız büyüsün.
              <br />
              Soru listeniz değil.
            </h2>
          </div>
          <div className="lg:pb-2">
            <Link href={APP_ROUTES.login} className={styles.primaryLink}>
              {BILLING_TRIAL.days} gün ücretsiz deneyin
              <span className={styles.linkArrow}>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
              </span>
            </Link>
            <p className="mt-3 text-xs text-[#889a76] lg:text-center">
              Mağazanızı bağlayarak başlayın.
            </p>
          </div>
        </LandingReveal>
        <div className="mt-16 flex flex-col justify-between gap-7 border-t border-[#d7e1cb] pt-7 sm:mt-20 md:flex-row md:items-center">
          <LandingBrand />
          <nav aria-label="Alt menü" className="flex flex-wrap gap-x-5 gap-y-3">
            {LANDING_NAVIGATION.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className="text-xs text-[#728462] transition-[color,transform] hover:text-[#253d20] active:translate-y-px active:text-[#245d46]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={APP_ROUTES.contact}
              className="text-xs text-[#728462] transition-[color,transform] hover:text-[#253d20] active:translate-y-px active:text-[#245d46]"
            >
              İletişim
            </Link>
          </nav>
          <p className="text-[11px] text-[#8c9c7d]">
            © {new Date().getFullYear()} Core Asistan
          </p>
        </div>
        <FooterWordmark
          className={`${styles.footerWordmark} mt-14 -mb-3 text-center select-none sm:mt-16 sm:-mb-5`}
        />
      </div>
    </footer>
  )
}
