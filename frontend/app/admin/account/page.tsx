import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { AccountProfile } from "@/components/dashboard/account/account-profile"
import { ActiveSessions } from "@/components/dashboard/account/active-sessions"
import { ConnectedAccounts } from "@/components/dashboard/account/connected-accounts"
import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import { getServerAccountOverview } from "@/lib/api/users.server"
import { getCurrentUser } from "@/lib/server-auth"

export const metadata: Metadata = {
  title: "Hesap ve güvenlik | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

type AdminAccountPageProps = {
  searchParams: Promise<{
    linked?: string
    error?: string
  }>
}

export default async function AdminAccountPage({
  searchParams,
}: AdminAccountPageProps) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect(APP_ROUTES.login)

  const [overview, params] = await Promise.all([
    getServerAccountOverview(),
    searchParams,
  ])

  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-7 px-5 py-8 sm:px-8 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            Hesap ve güvenlik
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Profilinizi, giriş yöntemlerinizi ve açık yönetici oturumlarınızı
            yönetin.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit gap-1.5 bg-card font-medium text-muted-foreground"
        >
          <HugeiconsIcon
            icon={ShieldCheckIcon}
            className="size-3.5 text-primary"
          />
          Sistem yöneticisi
        </Badge>
      </header>

      <div className="space-y-6">
        <AccountProfile
          user={currentUser.user}
          roleLabel="Sistem yöneticisi"
          roleDescription="Core Asistan operasyonlarını, müşteri hesaplarını ve sistem sağlığını yönetebilir."
        />
        <ConnectedAccounts
          initialAccounts={overview.accounts}
          initialLinkedProvider={params.linked}
          initialLinkError={params.error}
          callbackPath={APP_ROUTES.admin.account}
        />
        <ActiveSessions initialSessions={overview.sessions} />

        <section className="flex gap-4 rounded-xl border border-border bg-card px-5 py-5 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={ShieldCheckIcon} className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Admin erişimi</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Yönetim yetkisi sunucu yapılandırmasındaki doğrulanmış e-posta
              listesiyle kontrol edilir. Bu nedenle admin hesabı silme işlemi bu
              panelden sunulmaz; erişim önce sunucu yapılandırmasından
              kaldırılmalıdır.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
