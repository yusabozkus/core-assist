import { ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export function AdminSectionPlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mt-10 flex max-w-2xl items-start gap-3 border-t border-border py-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Yetkilendirme hazır</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Bu alan yalnızca backend tarafından doğrulanan admin hesaplarına
            açıktır. Modülün operasyon verileri sonraki geliştirme fazında
            bağlanacak.
          </p>
        </div>
      </div>
    </main>
  )
}
