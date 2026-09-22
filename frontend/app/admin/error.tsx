"use client"

import { useEffect } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin route could not be rendered.", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-full w-full max-w-[1440px] items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
          Sayfa şu anda yüklenemedi
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sunucuya erişilirken geçici bir sorun oluştu. İşlem yapılmadı;
          bağlantı düzeldikten sonra güvenle yeniden deneyebilirsiniz.
        </p>

        {error.digest ? (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Hata referansı: <code>{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={reset}>
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            Yeniden dene
          </Button>
          <Button asChild variant="outline">
            <Link href={APP_ROUTES.admin.root}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Admin ana sayfa
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
