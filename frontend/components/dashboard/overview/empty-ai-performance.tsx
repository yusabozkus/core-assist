import Link from "next/link"
import { AiSparklesIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"

export function EmptyAiPerformance() {
  return (
    <section className="flex min-h-100 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={AiSparklesIcon} className="size-5" />
      </span>
      <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">
        AI performans verisi henüz oluşmadı
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Gelen kutusundaki bir ürün sorusu için taslak oluşturduğunuzda kabul,
        düzenleme ve güven metrikleri burada görünmeye başlayacak.
      </p>
      <Button asChild size="sm" className="mt-6">
        <Link href={APP_ROUTES.dashboard.inbox}>
          Gelen kutusuna git
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Link>
      </Button>
    </section>
  )
}
