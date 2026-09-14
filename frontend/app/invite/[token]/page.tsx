import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Calendar03Icon,
  Layers01Icon,
  Store01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { InvitationAcceptance } from "@/components/invite/invitation-acceptance"
import { ThemeToggle } from "@/components/theme-toggle"
import { getServerWorkspaceInvitation } from "@/lib/api/team.server"
import { getCurrentUser } from "@/lib/server-auth"
import { getTeamAccessLabel } from "@/lib/team"

export const metadata: Metadata = {
  title: "Ekip Daveti | Core Asistan",
  description: "Core Asistan ekibinize katılın.",
}

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const [invitation, currentUser] = await Promise.all([
    getServerWorkspaceInvitation(token),
    getCurrentUser(),
  ])
  if (!invitation) notFound()

  return (
    <main className="relative flex min-h-dvh flex-col bg-background px-5 py-6 sm:px-8">
      <div className="pointer-events-none absolute top-0 left-1/2 h-72 w-[min(42rem,90vw)] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <header className="relative z-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HugeiconsIcon icon={Layers01Icon} className="size-4.5" />
          </span>
          <span className="font-semibold tracking-[-0.03em]">Core Asistan</span>
        </Link>
        <ThemeToggle className="border border-border bg-card" />
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 items-center py-12">
        <section className="w-full overflow-hidden rounded-2xl border border-border bg-card/90 shadow-xl shadow-foreground/[0.04] backdrop-blur">
          <div className="border-b border-border px-6 py-7 sm:px-8">
            <p className="text-xs font-medium text-primary">Ekip daveti</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
              {invitation.workspaceName} ekibine katılın
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {invitation.invitedByName
                ? `${invitation.invitedByName} sizi Core Asistan üzerinde birlikte çalışmaya davet etti.`
                : "Core Asistan üzerinde birlikte çalışmanız için bir davet aldınız."}
            </p>
          </div>

          <dl className="grid gap-px bg-border sm:grid-cols-3">
            <InviteDetail
              icon={UserGroupIcon}
              label="Yetki"
              value={getTeamAccessLabel(invitation.accessLevel)}
            />
            <InviteDetail
              icon={Store01Icon}
              label="Mağaza"
              value={
                invitation.accessLevel === "ACCOUNT_ADMIN"
                  ? "Tüm mağazalar"
                  : invitation.stores.map((store) => store.name).join(", ")
              }
            />
            <InviteDetail
              icon={Calendar03Icon}
              label="Son tarih"
              value={dateFormatter.format(new Date(invitation.expiresAt))}
            />
          </dl>

          <div className="px-6 py-7 sm:px-8">
            <InvitationAcceptance
              token={token}
              invitation={invitation}
              user={
                currentUser
                  ? {
                      name: currentUser.user.name,
                      email: currentUser.user.email,
                    }
                  : null
              }
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function InviteDetail({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 bg-card px-5 py-4">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-xs font-medium" title={value}>
        {value || "—"}
      </dd>
    </div>
  )
}
