import Image from "next/image"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { ProductQuestion } from "@/types/question"

export function ProductContext({ question }: { question: ProductQuestion }) {
  const imageUrl = question.product?.images[0]?.url

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        İlgili ürün
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-muted-foreground">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={question.product?.title ?? "Ürün"}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <HugeiconsIcon icon={Package01Icon} className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {question.product?.title ?? "Ürün eşleştirilemedi"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {question.product
              ? [question.product.brand, question.product.category]
                  .filter(Boolean)
                  .join(" · ")
              : `Platform ürün kodu: ${question.externalProductId}`}
          </p>
        </div>
      </div>
    </div>
  )
}
