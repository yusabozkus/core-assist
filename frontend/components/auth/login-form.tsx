"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { authClient } from "@/lib/auth-client"

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 23 23"
      width="19"
      height="19"
      {...props}
    >
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f3" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  )
}

type LoginFormProps = {
  reason?: string
  returnTo?: string
}

function getSafeReturnTo(returnTo?: string) {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return APP_ROUTES.dashboard.root
  }

  return returnTo
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin."
}

export function LoginForm({ reason, returnTo }: LoginFormProps) {
  const [isLoadingGoogle, setIsLoadingGoogle] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setIsLoadingGoogle(true)

    try {
      const callbackURL = new URL(
        getSafeReturnTo(returnTo),
        window.location.origin
      ).toString()

      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      })

      if (res?.error) {
        setErrorMessage(res.error.message || "Google ile giriş başlatılamadı.")
        setIsLoadingGoogle(false)
        return
      }

      if (res?.data?.url) {
        window.location.assign(res.data.url)
        return
      }

      setIsLoadingGoogle(false)
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
      setIsLoadingGoogle(false)
    }
  }

  const statusMessage =
    errorMessage ??
    (reason === "session_expired"
      ? "Oturumunuzun süresi doldu. Devam etmek için yeniden giriş yapın."
      : null)
  const isError = Boolean(errorMessage)

  return (
    <div className="w-full">
      <div className="mb-9">
        <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          Yönetim paneli girişi
        </p>
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-foreground sm:text-[2.25rem]">
          Tekrar hoş geldiniz
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Mağazalarınızı ve müşteri operasyonlarınızı yönetmeye devam etmek için
          hesabınızı seçin.
        </p>
      </div>

      {statusMessage && (
        <div
          role={isError ? "alert" : "status"}
          aria-live="polite"
          className={
            isError
              ? "mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
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

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          onClick={handleGoogleSignIn}
          disabled={isLoadingGoogle}
          aria-busy={isLoadingGoogle}
          className="group h-14 w-full justify-between rounded-xl bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/92"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm">
              {isLoadingGoogle ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <GoogleIcon />
              )}
            </span>
            <span>
              {isLoadingGoogle
                ? "Google'a yönlendiriliyor..."
                : "Google ile devam et"}
            </span>
          </span>

          {!isLoadingGoogle && (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 opacity-65 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          )}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled
          aria-describedby="microsoft-status"
          className="h-14 w-full justify-between rounded-xl border-border bg-card px-4 text-foreground opacity-70 shadow-xs"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-white">
              <MicrosoftIcon />
            </span>
            <span>Microsoft ile devam et</span>
          </span>
          <span
            id="microsoft-status"
            className="rounded-md bg-muted px-2 py-1 text-[9px] font-bold tracking-[0.09em] text-muted-foreground uppercase"
          >
            Yakında
          </span>
        </Button>
      </div>

      <div className="mt-7 flex items-start gap-3 rounded-xl border border-border/80 bg-muted/55 p-3.5">
        <HugeiconsIcon
          icon={ShieldCheckIcon}
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Parolanız CoreAssist ile paylaşılmaz. Kimlik doğrulama Google üzerinden
          tamamlanır; hesap kimliğiniz ve güvenli oturum verileriniz hizmetin
          çalışması için korunarak saklanır.
        </p>
      </div>

      <p className="mt-7 text-center text-[11px] leading-5 text-muted-foreground/75">
        Devam ederek kullanım koşullarını ve gizlilik politikasını kabul etmiş
        olursunuz.
      </p>
    </div>
  )
}
