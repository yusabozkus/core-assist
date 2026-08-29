"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/auth-client"

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
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
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 23 23" width="18" height="18" {...props}>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f3" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  )
}

export function LoginForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setErrorMessage(null)
    setIsLoadingGoogle(true)

    try {
      const callbackURL = typeof window !== "undefined" 
        ? `${window.location.origin}/dashboard`
        : "http://localhost:3001/dashboard"

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
        window.location.href = res.data.url
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.")
      setIsLoadingGoogle(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Çalışma Alanına Giriş
        </h1>
        <p className="text-sm text-muted-foreground">
          CoreAssist e-ticaret operasyon masanıza erişmek için hesabınızla devam edin.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-center">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isLoadingGoogle}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border-border hover:bg-muted/60 text-foreground font-medium text-sm transition-all shadow-xs"
        >
          {isLoadingGoogle ? (
            <div className="size-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          ) : (
            <GoogleIcon />
          )}
          <span>
            {isLoadingGoogle ? "Yönlendiriliyor..." : "Google ile Devam Et"}
          </span>
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled
          className="w-full h-12 flex items-center justify-between px-4 rounded-xl border-border opacity-60 cursor-not-allowed bg-muted/20 text-muted-foreground text-sm"
        >
          <div className="flex items-center gap-3">
            <MicrosoftIcon />
            <span>Microsoft ile Devam Et</span>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider bg-muted px-2 py-0.5 rounded text-muted-foreground">
            Yakında
          </span>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground leading-relaxed pt-2">
        Devam ederek{" "}
        <Link href="#" className="underline underline-offset-4 hover:text-foreground">
          Kullanım Koşulları
        </Link>{" "}
        ve{" "}
        <Link href="#" className="underline underline-offset-4 hover:text-foreground">
          Gizlilik Politikasını
        </Link>{" "}
        kabul etmiş olursunuz.
      </p>
    </div>
  )
}
