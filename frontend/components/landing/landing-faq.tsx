"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { LandingReveal } from "./landing-reveal"
import styles from "./landing.module.css"

const questions = [
  {
    id: "channels",
    question: "Hangi pazaryerleriyle çalışıyor?",
    answer:
      "Core Asistan şu anda Trendyol ve Hepsiburada ürün katalogları ve ürün sorularını destekliyor. Satıcı hesabınızın bağlantı bilgileriyle mağazanızı ekleyebilirsiniz.",
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
] as const

type QuestionId = (typeof questions)[number]["id"]

export function LandingFaq() {
  const [openId, setOpenId] = useState<QuestionId>(questions[0].id)
  const reduceMotion = useReducedMotion()

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
          {questions.map((item, index) => {
            const isOpen = item.id === openId
            const triggerId = `faq-${item.id}-trigger`
            const panelId = `faq-${item.id}-panel`

            return (
              <div key={item.id} className="border-b border-[#dce4d1]">
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(item.id)}
                    className="group flex w-full cursor-pointer items-start gap-5 py-6 text-left transition-[background-color,transform] outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#45856a] focus-visible:ring-offset-4 active:translate-x-0.5 active:bg-[#eef3e8]/50"
                  >
                    <span className="mt-0.5 text-[11px] text-[#99a58c]">
                      0{index + 1}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium transition-colors duration-300 sm:text-[15px]",
                        isOpen ? "text-[#245d46]" : "text-[#17281f]"
                      )}
                    >
                      {item.question}
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative mt-1 flex size-4 shrink-0 items-center justify-center"
                    >
                      <span className="h-px w-3 bg-[#637952]" />
                      <motion.span
                        className="absolute h-3 w-px bg-[#637952]"
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.28,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      initial={
                        reduceMotion
                          ? { opacity: 1 }
                          : { height: 0, opacity: 0 }
                      }
                      animate={{ height: "auto", opacity: 1 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { height: 0, opacity: 0 }
                      }
                      transition={{
                        height: {
                          duration: reduceMotion ? 0 : 0.42,
                          ease: [0.22, 1, 0.36, 1],
                        },
                        opacity: {
                          duration: reduceMotion ? 0 : 0.26,
                          ease: "easeOut",
                        },
                      }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[560px] pb-6 pl-9 text-sm leading-7 text-[#77846a]">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
