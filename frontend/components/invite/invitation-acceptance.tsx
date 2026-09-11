"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight01Icon,
  Loading03Icon,
  Logout01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { authClient } from "@/lib/auth-client"
import { acceptWorkspaceInvitation } from "@/lib/api/team"
import type { WorkspaceInvitationPreview } from "@/types/team"

export function InvitationAcceptance({
  token,
  invitation,
  user,
}: {
  token: string
  invitation: WorkspaceInvitationPreview
  user: { name: string; email: string } | null
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const [switchingAccount, setSwitchingAccount] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const returnTo = `/invite/${encodeURIComponent(token)}`
  const loginHref = `${APP_ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`
  const canAccept = invitation.status === "PENDING"

  async function accept() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await acceptWorkspaceInvitation(token)
      window.location.replace(result.nextPath)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Davet kabul edilemedi. Lütfen tekrar deneyin."
      )
      setSubmitting(false)
    }
  }

  async function switchAccount() {
    setSwitchingAccount(true)
    await authClient.signOut().catch(() => undefined)
    window.location.assign(loginHref)
  }

  if (!canAccept) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
          {invitation.status === "EXPIRED"
            ? "Bu davetin süresi dolmuş. Ekip yöneticinizden yeni bir bağlantı istemelisiniz."
            : invitation.status === "ACCEPTED"
              ? "Bu davet daha önce kabul edilmiş."
              : "Bu davet ekip yöneticisi tarafından iptal edilmiş."}
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={APP_ROUTES.home}>Ana sayfaya dön</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={ShieldCheckIcon} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Güvenli ekip daveti</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Davet yalnızca {invitation.email} adresiyle doğrulanmış Google
              veya Microsoft hesabı tarafından kabul edilebilir.
            </p>
          </div>
        </div>
      </div>

      {user ? (
        <>
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Giriş yapılan hesap
            </p>
            <p className="mt-1.5 truncate text-sm font-medium">{user.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-5 text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button
            className="w-full"
            disabled={submitting || switchingAccount}
            onClick={() => void accept()}
          >
            <HugeiconsIcon
              icon={submitting ? Loading03Icon : ArrowRight01Icon}
              className={submitting ? "size-4 animate-spin" : "size-4"}
            />
            {submitting ? "Davet kabul ediliyor" : "Daveti kabul et"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={submitting || switchingAccount}
            onClick={() => void switchAccount()}
          >
            <HugeiconsIcon
              icon={switchingAccount ? Loading03Icon : Logout01Icon}
              className={switchingAccount ? "size-4 animate-spin" : "size-4"}
            />
            Farklı hesapla devam et
          </Button>
        </>
      ) : (
        <Button asChild className="w-full">
          <Link href={loginHref}>
            Google veya Microsoft ile devam et
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}
