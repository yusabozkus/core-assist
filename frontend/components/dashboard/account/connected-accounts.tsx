"use client"

import { useMemo, useState } from "react"
import {
  CheckmarkCircle01Icon,
  Link01Icon,
  RefreshIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  AuthProviderIcon,
  type AuthProvider,
} from "@/components/auth/auth-provider-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { APP_ROUTES } from "@/constants/site"
import { authClient } from "@/lib/auth-client"
import type { AuthAccountSummary } from "@/types/user"

const PROVIDERS: ReadonlyArray<{
  id: AuthProvider
  name: string
  description: string
}> = [
  {
    id: "google",
    name: "Google",
    description: "Google hesabınızla güvenli giriş yapın.",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    description: "Microsoft hesabınızla güvenli giriş yapın.",
  },
]

export function ConnectedAccounts({
  initialAccounts,
  initialLinkedProvider,
  initialLinkError,
}: {
  initialAccounts: AuthAccountSummary[]
  initialLinkedProvider?: string
  initialLinkError?: string
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [linkingProvider, setLinkingProvider] = useState<AuthProvider | null>(
    null
  )
  const [unlinkingAccount, setUnlinkingAccount] =
    useState<AuthAccountSummary | null>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [message, setMessage] = useState<string | null>(() =>
    initialLinkedProvider
      ? `${getProviderName(initialLinkedProvider)} hesabınız bağlandı.`
      : null
  )
  const [error, setError] = useState<string | null>(() =>
    initialLinkError ? getProviderError(initialLinkError) : null
  )

  const accountByProvider = useMemo(
    () => new Map(accounts.map((account) => [account.providerId, account])),
    [accounts]
  )

  async function handleLink(provider: AuthProvider) {
    if (linkingProvider) return

    setLinkingProvider(provider)
    setMessage(null)
    setError(null)

    try {
      const callbackURL = new URL(
        APP_ROUTES.dashboard.settings.profile,
        window.location.origin
      )
      callbackURL.searchParams.set("linked", provider)
      const errorCallbackURL = new URL(
        APP_ROUTES.dashboard.settings.profile,
        window.location.origin
      )

      const result = await authClient.linkSocial({
        provider,
        callbackURL: callbackURL.toString(),
        errorCallbackURL: errorCallbackURL.toString(),
        disableRedirect: true,
      })

      if (result.error) {
        throw new Error(getProviderError(result.error.code))
      }

      if (!result.data?.url) {
        throw new Error("Giriş sağlayıcısına yönlendirme başlatılamadı.")
      }

      window.location.assign(result.data.url)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Hesap bağlanamadı. Lütfen tekrar deneyin."
      )
      setLinkingProvider(null)
    }
  }

  async function handleUnlink() {
    if (!unlinkingAccount || isUnlinking || accounts.length <= 1) return

    setIsUnlinking(true)
    setMessage(null)
    setError(null)

    try {
      const result = await authClient.unlinkAccount({
        accountId: unlinkingAccount.id,
      })

      if (result.error || !result.data?.status) {
        throw new Error(result.error?.message || "Giriş yöntemi kaldırılamadı.")
      }

      const providerName = getProviderName(unlinkingAccount.providerId)
      setAccounts((current) =>
        current.filter((account) => account.id !== unlinkingAccount.id)
      )
      setUnlinkingAccount(null)
      setMessage(`${providerName} bağlantısı kaldırıldı.`)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Giriş yöntemi kaldırılamadı."
      )
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.01em]">Giriş yöntemleri</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Hesabınıza bağlı sağlayıcıları yönetin ve alternatif giriş ekleyin.
          </p>
        </div>
        <Badge variant="outline" className="font-medium text-muted-foreground">
          {accounts.length} bağlı hesap
        </Badge>
      </div>

      <div className="divide-y divide-border">
        {PROVIDERS.map((provider) => {
          const account = accountByProvider.get(provider.id)
          const isLinking = linkingProvider === provider.id
          const canUnlink = Boolean(account) && accounts.length > 1

          return (
            <div
              key={provider.id}
              className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white shadow-xs">
                  <AuthProviderIcon provider={provider.id} className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{provider.name}</p>
                    {account ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <HugeiconsIcon
                          icon={CheckmarkCircle01Icon}
                          className="size-3.5"
                        />
                        Bağlı
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Bağlı değil
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {account
                      ? `${formatDate(account.createdAt)} tarihinde bağlandı.`
                      : provider.description}
                  </p>
                </div>
              </div>

              {account ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start text-muted-foreground sm:self-auto"
                  disabled={!canUnlink}
                  title={
                    canUnlink
                      ? undefined
                      : "Hesabınızdaki tek giriş yöntemi kaldırılamaz."
                  }
                  onClick={() => setUnlinkingAccount(account)}
                >
                  <HugeiconsIcon icon={Unlink01Icon} className="size-4" />
                  Bağlantıyı kaldır
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-start bg-background sm:self-auto"
                  disabled={linkingProvider !== null}
                  onClick={() => void handleLink(provider.id)}
                >
                  <HugeiconsIcon
                    icon={isLinking ? RefreshIcon : Link01Icon}
                    className={`size-4 ${isLinking ? "animate-spin" : ""}`}
                  />
                  {isLinking ? "Yönlendiriliyor..." : "Hesabı bağla"}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {message || error ? (
        <div
          className="border-t border-border px-5 py-3 text-sm sm:px-6"
          aria-live="polite"
        >
          {message ? (
            <p className="text-emerald-600 dark:text-emerald-400">{message}</p>
          ) : null}
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      ) : null}

      <ResponsiveDialog
        open={Boolean(unlinkingAccount)}
        onOpenChange={(open) => {
          if (!open && !isUnlinking) setUnlinkingAccount(null)
        }}
        preventClose={isUnlinking}
        title="Giriş yöntemini kaldır"
        description={`${getProviderName(unlinkingAccount?.providerId)} hesabınızdan kaldırılacak.`}
        footer={({ close }) => (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isUnlinking}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleUnlink()}
              disabled={isUnlinking}
            >
              <HugeiconsIcon
                icon={isUnlinking ? RefreshIcon : Unlink01Icon}
                className={`size-4 ${isUnlinking ? "animate-spin" : ""}`}
              />
              {isUnlinking ? "Kaldırılıyor..." : "Evet, kaldır"}
            </Button>
          </>
        )}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Bu sağlayıcıyla tekrar giriş yapabilmek için hesabı yeniden bağlamanız
          gerekir. Diğer bağlı giriş yönteminiz kullanılmaya devam eder.
        </p>
      </ResponsiveDialog>
    </section>
  )
}

function getProviderName(providerId?: string) {
  if (providerId === "microsoft") return "Microsoft"
  if (providerId === "google") return "Google"
  return "Seçilen giriş yöntemi"
}

function getProviderError(code?: string) {
  switch (code?.toLowerCase()) {
    case "account_already_linked_to_different_user":
      return "Bu sağlayıcı hesabı başka bir CoreAssist hesabına bağlı."
    case "unable_to_link_account":
      return "Sağlayıcı hesabı doğrulanamadığı için bağlantı tamamlanamadı."
    case "provider_not_found":
    case "oauth_provider_not_found":
      return "Bu giriş yöntemi henüz yapılandırılmamış."
    default:
      return "Hesap bağlanamadı. Lütfen tekrar deneyin."
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}
