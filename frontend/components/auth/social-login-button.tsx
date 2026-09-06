"use client"

import type { SVGProps } from "react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"

export type LoginProvider = "google" | "microsoft"

type SocialLoginButtonProps = {
  provider: LoginProvider
  isLoading: boolean
  disabled: boolean
  isLastUsed: boolean
  onClick: () => void
}

const PROVIDER_LABELS = {
  google: {
    idle: "Google ile devam et",
    loading: "Google'a yönlendiriliyor...",
  },
  microsoft: {
    idle: "Microsoft ile devam et",
    loading: "Microsoft'a yönlendiriliyor...",
  },
} satisfies Record<LoginProvider, { idle: string; loading: string }>

export function SocialLoginButton({
  provider,
  isLoading,
  disabled,
  isLastUsed,
  onClick,
}: SocialLoginButtonProps) {
  const label = PROVIDER_LABELS[provider]

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      aria-busy={isLoading}
      className="group relative h-14 w-full justify-between rounded-xl border-border bg-card px-4 text-foreground shadow-xs"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white">
          {isLoading ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
            />
          ) : provider === "google" ? (
            <GoogleIcon />
          ) : (
            <MicrosoftIcon />
          )}
        </span>
        <span className="truncate text-[13px] sm:text-sm">
          {isLoading ? label.loading : label.idle}
        </span>
      </span>

      {!isLoading && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      )}

      {isLastUsed && (
        <span className="absolute -top-2.5 right-3 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] leading-4 font-medium text-muted-foreground">
          Son kullanılan
        </span>
      )}
    </Button>
  )
}

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
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

function MicrosoftIcon(props: SVGProps<SVGSVGElement>) {
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
