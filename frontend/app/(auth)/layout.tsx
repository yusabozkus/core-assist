import React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowLeft01Icon,
  Layers01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { LoginProductTour } from "@/components/auth/login-product-tour"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import { getProductScreenshots } from "@/lib/product-screenshots"
import { AppLogo } from "@/components/shared/brand/app-logo"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const currentUser = await getCurrentUser()

  if (currentUser) {
    redirect(APP_ROUTES.authContinue)
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(420px,1fr)_minmax(0,1fr)] lg:gap-3 lg:p-3">
      <section className="flex min-h-dvh min-w-0 flex-col px-5 py-5 sm:px-10 sm:py-8 lg:min-h-[calc(100dvh-24px)] lg:px-8 lg:py-6 xl:px-14">
        <header className="flex items-center justify-between gap-4">
          <AppLogo
            href="/"
            className="group flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none"
            showIcon={false}
            textWidth={150}
            description="Pazaryeri yanıt asistanınız"
          />
          <ThemeToggle className="border border-border bg-card shadow-xs hover:bg-muted" />
        </header>

        <main className="flex flex-1 items-center py-12 sm:py-16">
          <div className="mx-auto w-full max-w-[390px]">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5 text-[11px] text-muted-foreground">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5"
            />
            Ana sayfaya dön
          </Link>
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={ShieldCheckIcon}
              className="size-3.5 text-primary"
            />
            Güvenli erişim
          </span>
          <span className="basis-full text-[10px] text-muted-foreground/70 sm:basis-auto">
            © {new Date().getFullYear()} Core Asistan
          </span>
        </footer>
      </section>

      <LoginProductTour screenshots={getProductScreenshots()} />
    </div>
  )
}
