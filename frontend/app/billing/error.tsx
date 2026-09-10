"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function BillingError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-5 py-20">
      <h1 className="text-xl font-semibold">
        Faturalandırma bilgileri alınamadı
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Bilgileriniz değişmedi. Bağlantınızı kontrol edip tekrar
        deneyebilirsiniz.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Tekrar dene</Button>
        <Button asChild variant="outline">
          <Link href="/billing?choose=1">Çalışma alanlarına dön</Link>
        </Button>
      </div>
    </main>
  )
}
