import Link from "next/link"
import { ArrowRight01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ADMIN_NAVIGATION } from "@/constants/admin"
import { APP_ROUTES } from "@/constants/site"

export default function AdminOverviewPage() {
  const modules = ADMIN_NAVIGATION.filter(
    (item) => item.url !== APP_ROUTES.admin.root
  )

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-5 border-b border-border pb-8 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            İç operasyonlar
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Yönetim merkezi
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Müşteri desteği, abonelikler ve sistem operasyonları için güvenli
            çalışma alanı.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-4 text-primary" />
          Backend yetkilendirmesi etkin
        </div>
      </div>

      <section className="py-8">
        <div className="mb-5">
          <h2 className="text-sm font-semibold">Yönetim alanları</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Modüller geliştirme planındaki sırayla gerçek operasyon verilerine
            bağlanacak.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.url}
              href={module.url}
              className="group flex min-h-36 flex-col bg-card p-5 transition-colors hover:bg-muted/45"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon icon={module.icon} className="size-4.5" />
                </span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </div>
              <div className="mt-auto pt-5">
                <h3 className="text-sm font-semibold">{module.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {module.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
