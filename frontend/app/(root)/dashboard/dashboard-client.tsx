"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAccountIcon,
  Mail01Icon,
  Logout01Icon,
  ShieldCheckIcon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons"
import { useSession, signOut } from "@/lib/auth/auth-client"
import { APP_ROUTES } from "@/constants/site"

export function DashboardClient() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      router.push(APP_ROUTES.login)
    } catch {
      setIsLoggingOut(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const user = session?.user

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between p-6 sm:p-10 lg:p-14">
      <header className="flex items-center justify-between border-b border-border pb-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono text-xs font-bold shadow-md shadow-primary/25">
            CA
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">CoreAssist</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <HugeiconsIcon icon={Logout01Icon} className="size-3.5" />
            <span>{isLoggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}</span>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full my-auto py-10 space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3.5" />
            <span>Oturum Açıldı</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Hoş Geldiniz, {user?.name || "Kullanıcı"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Oturum ve kullanıcı hesap detaylarınız aşağıda listelenmiştir.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={UserAccountIcon} className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ad Soyad</div>
                <div className="text-sm font-semibold">{user?.name || "—"}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border/60 pt-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={Mail01Icon} className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">E-posta Adresi</div>
                <div className="text-sm font-semibold truncate">{user?.email || "—"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <HugeiconsIcon icon={ShieldCheckIcon} className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Kullanıcı ID</div>
                <div className="text-xs font-mono font-medium text-muted-foreground truncate max-w-[240px]">
                  {user?.id || "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border/60 pt-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">E-posta Doğrulama</div>
                <div className="text-xs font-medium text-emerald-500">
                  {user?.emailVerified ? "Doğrulandı" : "Beklemede / Aktif"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border pt-6 max-w-5xl mx-auto w-full flex items-center justify-between text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} CoreAssist Inc.</span>
        <span>Multi-Tenant Güvenli Oturum</span>
      </footer>
    </div>
  )
}
