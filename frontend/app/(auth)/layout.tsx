import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Layers01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { LoginProductTour } from "@/components/auth/login-product-tour"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/auth/server-auth"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentUser = await getCurrentUser()

  if (currentUser) {
    redirect(APP_ROUTES.dashboard)
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(420px,0.94fr)_minmax(0,1.06fr)]">
      <section className="flex min-h-dvh flex-col border-border/80 bg-background px-5 py-5 sm:px-10 sm:py-8 lg:border-r xl:px-16">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="CoreAssist ana sayfa"
            className="group flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-translate-y-0.5">
              <HugeiconsIcon icon={Layers01Icon} className="size-5" />
            </span>
            <span>
              <span className="block text-[15px] leading-none font-bold tracking-[-0.025em] text-foreground">
                CoreAssist
              </span>
              <span className="mt-1 block text-[10px] leading-none font-medium tracking-[0.13em] text-muted-foreground uppercase">
                Commerce operations
              </span>
            </span>
          </Link>

          <ThemeToggle className="border border-border bg-card shadow-xs hover:bg-muted" />
        </header>

        <main className="flex flex-1 items-center py-12 sm:py-16">
          <div className="mx-auto w-full max-w-[410px]">{children}</div>
        </main>

        <footer className="flex items-center justify-between border-t border-border/80 pt-5 text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} CoreAssist</span>
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={ShieldCheckIcon}
              className="size-3.5 text-primary"
            />
            Güvenli erişim
          </span>
        </footer>
      </section>

      <aside className="commerce-panel-grid relative hidden min-h-dvh overflow-hidden bg-[#10251e] text-white lg:flex">
        <div className="relative mx-auto flex w-full max-w-[900px] flex-col justify-center px-10 py-12 xl:px-16 2xl:px-20">
          <div className="mb-8 max-w-2xl">
            <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-[#9bc5b0] uppercase">
              Tek panel. Net operasyon.
            </p>
            <h2 className="max-w-2xl text-4xl leading-[1.1] font-semibold tracking-[-0.045em] text-white xl:text-[3.25rem]">
              Mağazalarınızı tek bir çalışma düzeninde yönetin.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#b7c9c0] xl:text-base xl:leading-7">
              Müşteri taleplerini takip edin, ürün ve stok durumunu görün, ekip
              iş yükünü kanallar arasında kaybolmadan yönetin.
            </p>
          </div>

          <LoginProductTour />

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#9fb5aa]">
            <span>Mağaza bazlı veri izolasyonu</span>
            <span className="size-1 rounded-full bg-[#4f7865]" />
            <span>Gerçek zamanlı senkronizasyon</span>
            <span className="size-1 rounded-full bg-[#4f7865]" />
            <span>Rol bazlı ekip erişimi</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
