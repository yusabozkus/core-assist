"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AuthProviderIcon,
  type AuthProvider,
} from "@/components/auth/auth-provider-icon"
import { Button } from "@/components/ui/button"

export type LoginProvider = AuthProvider

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
          ) : (
            <AuthProviderIcon provider={provider} className="size-5" />
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
