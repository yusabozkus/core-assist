import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { LANDING_NAVIGATION } from "@/constants/landing"
import { APP_ROUTES } from "@/constants/site"
import { FooterWordmark } from "./footer-wordmark"
import { LandingBrand } from "./landing-brand"
import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const questions = [
  {
    id: "channels",
    question: "Hangi pazaryerleriyle çalışıyor?",
    answer:
      "CoreAssist şu anda Trendyol ve Hepsiburada ürün katalogları ve ürün sorularını destekliyor. Satıcı hesabınızın bağlantı bilgileriyle mağazanızı ekleyebilirsiniz.",
  },
  {
    id: "catalog",
    question: "Ürünleri tek tek eklemem gerekiyor mu?",
    answer:
      "Hayır. Mağazanızı bağladığınızda ürünler, varyantlar, açıklamalar, özellikler ve pazaryerinde mevcut beden tabloları senkronize edilir. AI cevap hazırlarken ilgili ürünün bilgilerini kullanır.",
  },
  {
    id: "approval",
    question: "AI her cevabı otomatik mi gönderiyor?",
    answer:
      "Hayır, buna siz karar verirsiniz. Otomatik taslak modunda gönderimleri siz onaylarsınız. Güvenli otomatik gönderimde ise yalnızca kanıt, güven ve risk kontrollerini geçen yanıtlar gönderilir; diğerleri incelemeye kalır.",
  },
  {
    id: "inventory",
    question: "Soru geldiğinde stok değişmişse ne olur?",
    answer:
      "Stok soruları için taslak oluşturulmadan önce pazaryerinden kontrol yapılır. Otomatik gönderimden hemen önce tekrar doğrulanır. Bulunabilirlik değiştiyse veya stok doğrulanamıyorsa gönderim durur ve soru incelemeye alınır.",
  },
  {
    id: "knowledge",
    question: "Mağazamın dilini ve kurallarını nasıl belirlerim?",
    answer:
      "Yanıt ayarlarından tonu, uzunluğu, selamlama, kapanış ve emoji tercihlerinizi seçebilirsiniz. Özel AI talimatlarıyla davranışı, bilgi tabanıyla kargo, iade ve sık sorulanlar gibi mağaza bilgilerini tanımlarsınız.",
  },
]

export function LandingFaq() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div
        className={`${styles.container} grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20`}
      >
        <LandingReveal>
          <p className={`${styles.eyebrow} mb-5 text-[#6a805a]`}>
            Aklınızda kalmasın
          </p>
          <h2 className={styles.sectionTitle}>
            Birkaç soruyu
            <br />
            da biz yanıtlayalım.
          </h2>
          <p className="mt-6 max-w-[270px] text-sm leading-7 text-[#7c8771]">
            Başlamadan önce bilmek isteyebileceğiniz birkaç detay.
          </p>
        </LandingReveal>
        <div className="border-t border-[#dce4d1]">
          {questions.map((item, index) => (
            <details
              key={item.id}
              className="group border-b border-[#dce4d1]"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-start gap-5 py-6 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 text-[11px] text-[#99a58c]">
                  0{index + 1}
                </span>
                <span className="flex-1 text-sm font-medium sm:text-[15px]">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="relative mt-1 flex size-4 shrink-0 items-center justify-center"
                >
                  <span className="h-px w-3 bg-[#637952]" />
                  <span className="absolute h-3 w-px bg-[#637952] transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <p className="max-w-[560px] pb-6 pl-9 text-sm leading-7 text-[#77846a]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

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
              7 gün ücretsiz deneyin
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
                className="text-xs text-[#728462] transition-colors hover:text-[#253d20]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <p className="text-[11px] text-[#8c9c7d]">
            © {new Date().getFullYear()} CoreAssist
          </p>
        </div>
        <FooterWordmark
          className={`${styles.footerWordmark} mt-14 -mb-3 text-center select-none sm:mt-16 sm:-mb-5`}
        />
      </div>
    </footer>
  )
}
