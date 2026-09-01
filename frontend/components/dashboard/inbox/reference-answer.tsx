import { Badge } from "@/components/ui/badge"
import { providerName } from "@/components/dashboard/inbox/question-inbox-utils"
import type { ProductQuestion } from "@/types/question"

export function ReferenceAnswer({ question }: { question: ProductQuestion }) {
  if (!question.referenceAnswer) return null

  if (question.status === "PENDING" && !question.answer) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3.5 sm:px-5">
        <p className="text-sm font-medium text-foreground">
          Gerçek satıcı cevabı hazır
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tarafsız karşılaştırma için önce AI taslağını oluşturun. Referans cevap
          daha sonra açılacaktır.
        </p>
      </div>
    )
  }

  const sourceName = question.referenceSourceProvider
    ? providerName(question.referenceSourceProvider)
    : "Pazaryeri"

  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none sm:px-5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            DeFacto&apos;nun gerçek cevabı
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI taslağını oluşturduktan sonra karşılaştırmak için açın.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 bg-background">
          {sourceName}
        </Badge>
      </summary>
      <div className="border-t border-border px-4 py-4 sm:px-5">
        <p className="text-sm leading-6 text-foreground">
          {question.referenceAnswer}
        </p>
        {question.referenceSourceUrl ? (
          <a
            href={question.referenceSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Kaynak soru-cevap sayfasını aç
          </a>
        ) : null}
      </div>
    </details>
  )
}
