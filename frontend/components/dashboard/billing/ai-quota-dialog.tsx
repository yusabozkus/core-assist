"use client"

import Link from "next/link"
import {
  ArrowUpRight01Icon,
  CheckmarkCircle01Icon,
  MagicWand01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"

export function AiQuotaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ResponsiveDialog
      dismissOnOutsideInteraction={false}
      dismissOnEscape={false}
      open={open}
      onOpenChange={onOpenChange}
      title="AI soru hakkınız doldu"
      description="Bu dönem için planınızdaki AI taslak limitine ulaştınız."
      contentClassName="sm:max-w-lg"
      footer={({ close }) => (
        <>
          <Button type="button" variant="outline" onClick={close}>
            Tamam
          </Button>
          <Button asChild>
            <Link href={APP_ROUTES.dashboard.settings.plans}>
              Planı yükselt
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
            </Link>
          </Button>
        </>
      )}
    >
      <div className="divide-y divide-border">
        <div className="flex items-start gap-3 pb-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <HugeiconsIcon icon={MagicWand01Icon} className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              AI taslakları geçici olarak duraklatıldı
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Yeni taslak üretimi ve otomatik gönderim, döneminiz yenilenene
              veya planınızı yükseltene kadar çalışmaz.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              Gelen kutunuz çalışmaya devam eder
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Yeni sorular alınmaya devam eder ve istediğiniz kadar manuel yanıt
              gönderebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
