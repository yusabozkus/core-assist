import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserAccountIcon,
  Mail01Icon,
  ShieldCheckIcon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons"
import type { AuthUser } from "@/types/auth"
import type { StoreSummary } from "@/types/store"

export function DashboardClient({
  user,
  activeStore,
}: {
  user: AuthUser | null
  activeStore: StoreSummary | null
}) {
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background p-6 text-foreground sm:p-10 lg:p-14">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground shadow-md shadow-primary/25">
            {activeStore
              ? activeStore.name.substring(0, 2).toUpperCase()
              : "CA"}
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              {activeStore ? activeStore.name : "CoreAssist"}
            </h1>
            <p className="text-xs text-muted-foreground">Aktif mağaza</p>
          </div>
        </div>
      </header>

      <main className="mx-auto my-auto w-full max-w-5xl space-y-8 py-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
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
                <div className="text-xs text-muted-foreground">
                  E-posta Adresi
                </div>
                <div className="truncate text-sm font-semibold">
                  {user?.email || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <HugeiconsIcon icon={ShieldCheckIcon} className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Kullanıcı ID
                </div>
                <div className="max-w-60 truncate font-mono text-xs font-medium text-muted-foreground">
                  {user?.id || "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border/60 pt-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  E-posta Doğrulama
                </div>
                <div className="text-xs font-medium text-emerald-500">
                  {user?.emailVerified ? "Doğrulandı" : "Beklemede / Aktif"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between border-t border-border pt-6 text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} CoreAssist Inc.</span>
        <span>Multi-Tenant Güvenli Oturum</span>
      </footer>
    </div>
  )
}
