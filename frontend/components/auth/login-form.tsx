"use client"

import * as React from "react"
import { AlertCircleIcon, ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SocialLoginButton,
  type LoginProvider,
} from "@/components/auth/social-login-button"
import { APP_ROUTES } from "@/constants/site"
import { authClient } from "@/lib/auth-client"

type LoginFormProps = {
  reason?: string
  returnTo?: string
  error?: string
  lastUsedProvider?: LoginProvider
}

function getSafeReturnTo(returnTo: string | undefined, origin: string) {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return APP_ROUTES.authContinue
  }

  try {
    const url = new URL(returnTo, origin)
    return url.origin === origin
      ? `${url.pathname}${url.search}${url.hash}`
      : APP_ROUTES.authContinue
  } catch {
    return APP_ROUTES.authContinue
  }
}

function getAuthErrorMessage(code?: string) {
  if (!code) return null

  switch (code.toLowerCase().replaceAll(" ", "_")) {
    case "access_denied":
    case "user_cancelled":
      return "Giriş işlemi tamamlanmadı. Devam etmek için hesabınızla tekrar giriş yapabilirsiniz."
    case "provider_not_found":
    case "oauth_provider_not_found":
      return "Bu giriş yöntemi henüz yapılandırılmamış. Lütfen diğer giriş yöntemini kullanın."
    case "account_not_linked":
    case "unable_to_link_account":
    case "account_already_linked_to_different_user":
      return "Bu e-posta adresiyle bir hesap zaten mevcut. Güvenliğiniz için hesabınızı oluşturduğunuz giriş yöntemini kullanın."
    case "email_not_found":
    case "user_email_not_found":
      return "Hesabınızın e-posta bilgisi alınamadı. E-posta bilgisi bulunan başka bir hesapla giriş yapın veya kurum yöneticinizle iletişime geçin."
    case "state_not_found":
    case "state_mismatch":
    case "state_expired":
    case "invalid_code":
      return "Giriş oturumu doğrulanamadı veya süresi doldu. Lütfen yeniden deneyin."
    default:
      return "Giriş tamamlanamadı. Lütfen tekrar deneyin veya diğer giriş yöntemini kullanın."
  }
}

export function LoginForm({
  reason,
  returnTo,
  error,
  lastUsedProvider,
}: LoginFormProps) {
  const [loadingProvider, setLoadingProvider] =
    React.useState<LoginProvider | null>(null)
  const signInPending = React.useRef(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(() =>
    getAuthErrorMessage(error)
  )

  const handleSignIn = async (provider: LoginProvider) => {
    if (signInPending.current) return
    signInPending.current = true
    setErrorMessage(null)
    setLoadingProvider(provider)

    try {
      const safeReturnTo = getSafeReturnTo(returnTo, window.location.origin)
      const callbackURL = new URL(
        safeReturnTo,
        window.location.origin
      ).toString()
      const errorCallbackURL = new URL(APP_ROUTES.login, window.location.origin)
      errorCallbackURL.searchParams.set("returnTo", safeReturnTo)

      const res = await authClient.signIn.social({
        provider,
        callbackURL,
        errorCallbackURL: errorCallbackURL.toString(),
        disableRedirect: true,
      })

      if (res?.error) {
        setErrorMessage(getAuthErrorMessage(res.error.code || "sign_in_failed"))
        setLoadingProvider(null)
        signInPending.current = false
        return
      }

      if (res?.data?.url) {
        window.location.assign(res.data.url)
        return
      }

      setErrorMessage(getAuthErrorMessage("sign_in_failed"))
      setLoadingProvider(null)
      signInPending.current = false
    } catch {
      setErrorMessage("Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.")
      setLoadingProvider(null)
      signInPending.current = false
    }
  }

  const statusMessage =
    errorMessage ??
    (reason === "session_expired"
      ? "Oturumunuzun süresi doldu. Devam etmek için yeniden giriş yapın."
      : reason === "account_deleted"
        ? "Core Asistan hesabınız ve hesabınıza ait veriler kalıcı olarak silindi."
        : null)
  const isError = Boolean(errorMessage)
  const isSuccess = !isError && reason === "account_deleted"

  return (
    <div className="w-full">
      <div className="mb-8 sm:mb-9">
        <p className="mb-4 flex items-center gap-2.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-primary/50" aria-hidden="true" />
          Çalışma alanınız
        </p>
        <h1 className="text-[2.125rem] leading-[1.14] font-semibold tracking-[-0.045em] text-foreground sm:text-[2.5rem]">
          Hoş geldiniz.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Ürün sorularınızı yanıtlamak ve mağazanızın AI akışını yönetmek için
          hesabınızla devam edin.
        </p>
      </div>

      {statusMessage && (
        <div
          role={isError ? "alert" : "status"}
          aria-live="polite"
          className={
            isError
              ? "mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
              : isSuccess
                ? "mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-5 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                : "mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
          }
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="space-y-4">
        <SocialLoginButton
          provider="google"
          isLoading={loadingProvider === "google"}
          isLastUsed={lastUsedProvider === "google"}
          onClick={() => handleSignIn("google")}
          disabled={loadingProvider !== null}
        />
        <SocialLoginButton
          provider="microsoft"
          isLoading={loadingProvider === "microsoft"}
          isLastUsed={lastUsedProvider === "microsoft"}
          onClick={() => handleSignIn("microsoft")}
          disabled={loadingProvider !== null}
        />
      </div>

      <div className="mt-6 flex items-start gap-2.5 px-0.5">
        <HugeiconsIcon
          icon={ShieldCheckIcon}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground/70"
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Parolanız Core Asistan ile paylaşılmaz. Kimlik doğrulama seçtiğiniz
          Google veya Microsoft hesabı üzerinden tamamlanır.
        </p>
      </div>

      <p className="mt-8 border-t border-border/70 pt-5 text-[11px] leading-5 text-muted-foreground/75">
        Devam ederek kullanım koşullarını ve gizlilik politikasını kabul etmiş
        olursunuz.
      </p>
    </div>
  )
}
