import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

const questions = [
  {
    question: "7 günlük deneme nasıl çalışır?",
    answer:
      "İlk aboneliğinizde seçtiğiniz planı 7 gün ücretsiz deneyebilirsiniz. Deneme hakkı tüm planlar için geçerlidir.",
  },
  {
    question: "Yıllık ödemede ne kadar avantajım var?",
    answer:
      "Aylık plan ücretinin 12 katına %10 indirim uygulanır. Yıllık toplam tek seferde faturalandırılır; soru hakları her ay yenilenir.",
  },
  {
    question: "Hangi limit bana uygun?",
    answer:
      "Önce aylık aldığınız ürün sorusu sayısını, ardından mağaza sayınızı ve katalog büyüklüğünüzü değerlendirin. Mevcut kullanımınızı abonelik özetinden görebilirsiniz.",
  },
]

export function PlanQuestions() {
  return (
    <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          Plan seçerken
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
          Ücretlendirme ve kullanım hakkında bilmeniz gerekenler.
        </p>
      </div>
      <div className="divide-y divide-border">
        {questions.map((item) => (
          <details
            key={item.question}
            name="billing-questions"
            className="group py-4 first:pt-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {item.question}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
