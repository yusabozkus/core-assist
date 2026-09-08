import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

const questions = [
  {
    question: "10 günlük deneme nasıl çalışır?",
    answer:
      "Kart bilgisi vermeden 10 gün boyunca 1 mağaza, 100 işlenen soru ve 1.000 ürüne kadar tüm özellikleri deneyebilirsiniz.",
  },
  {
    question: "Yıllık ödemede ne kadar avantajım var?",
    answer:
      "Aylık plan ücretinin 12 katına %10 indirim uygulanır. Yıllık toplam tek seferde faturalandırılır; soru hakları her ay yenilenir.",
  },
  {
    question: "Soru hakkı nasıl hesaplanır?",
    answer:
      "Bir pazaryeri sorusu ilk kez başarıyla analiz edilip taslağı hazırlandığında bir kullanım sayılır. Taslağı düzenlemek, göndermek veya aynı soru için ilk üç taslağı oluşturmak ek kullanım oluşturmaz. Dördüncü ve sonraki her taslak bir ek kullanım sayılır; başarısız AI istekleri kotadan düşmez.",
  },
  {
    question: "Soru hakkım biterse ne olur?",
    answer:
      "Yeni sorular gelen kutunuza gelmeye devam eder ve manuel yanıt verebilirsiniz. AI taslağı ile otomatik gönderim yeni dönem başlayana veya planınızı yükseltene kadar duraklatılır; sürpriz ek ücret alınmaz.",
  },
  {
    question: "Pazaryeri bağlantısı sınırı var mı?",
    answer:
      "Hayır. Planınızdaki mağaza sınırı içinde CoreAssist'in desteklediği Trendyol ve Hepsiburada bağlantılarının tamamını kullanabilirsiniz.",
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
