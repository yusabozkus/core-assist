import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { formatCount } from "./analytics-format"

export function CurrentReviewWorkload({ count }: { count: number }) {
  return (
    <section
      aria-labelledby="current-review-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div>
        <h2
          id="current-review-title"
          className="text-[11px] font-medium text-muted-foreground"
        >
          Mağazada şu an
        </h2>
        <p className="mt-1 text-sm font-medium">
          {count > 0 ? (
            <>
              <span className="font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                {formatCount(count)} soru
              </span>{" "}
              inceleme bekliyor
            </>
          ) : (
            "İnceleme bekleyen soru yok"
          )}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tüm tarihler ve pazaryerleri
        </p>
      </div>
      {count > 0 ? (
        <Button asChild variant="outline" size="sm" className="sm:shrink-0">
          <Link
            href={`${APP_ROUTES.dashboard.inbox}?status=PENDING&pending=REVIEW_REQUIRED`}
          >
            Bekleyenleri incele
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
