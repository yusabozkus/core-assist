"use client"

import { useState } from "react"
import {
  ComputerIcon,
  LaptopIcon,
  Logout03Icon,
  RefreshIcon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import type { AccountSessionSummary } from "@/types/user"

export function ActiveSessions({
  initialSessions,
}: {
  initialSessions: AccountSessionSummary[]
}) {
  const [sessions, setSessions] = useState(initialSessions)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [isRevokingOthers, setIsRevokingOthers] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const otherSessionCount = sessions.filter(
    (session) => !session.isCurrent
  ).length

  async function revokeSession(token: string) {
    if (pendingToken || isRevokingOthers) return

    setPendingToken(token)
    setMessage(null)
    setError(null)

    try {
      const result = await authClient.revokeSession({ token })
      if (result.error || !result.data?.status) {
        throw new Error(result.error?.message || "Oturum kapatılamadı.")
      }

      setSessions((current) =>
        current.filter((session) => session.token !== token)
      )
      setMessage("Seçilen cihazdaki oturum kapatıldı.")
    } catch (caughtError) {
      setError(getSessionError(caughtError))
    } finally {
      setPendingToken(null)
    }
  }

  async function revokeOtherSessions() {
    if (isRevokingOthers || otherSessionCount === 0) return

    setIsRevokingOthers(true)
    setMessage(null)
    setError(null)

    try {
      const result = await authClient.revokeOtherSessions()
      if (result.error || !result.data?.status) {
        throw new Error(
          result.error?.message || "Diğer oturumlar kapatılamadı."
        )
      }

      setSessions((current) => current.filter((session) => session.isCurrent))
      setMessage("Diğer tüm cihazlardaki oturumlar kapatıldı.")
    } catch (caughtError) {
      setError(getSessionError(caughtError))
    } finally {
      setIsRevokingOthers(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold tracking-[-0.01em]">Aktif oturumlar</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Hesabınızın açık olduğu cihazları inceleyin ve erişimleri yönetin.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-background"
          disabled={isRevokingOthers || otherSessionCount === 0}
          onClick={() => void revokeOtherSessions()}
        >
          <HugeiconsIcon
            icon={isRevokingOthers ? RefreshIcon : Logout03Icon}
            className={`size-4 ${isRevokingOthers ? "animate-spin" : ""}`}
          />
          {isRevokingOthers ? "Kapatılıyor..." : "Diğer cihazlardan çık"}
        </Button>
      </div>

      <div className="divide-y divide-border">
        {sessions.map((session) => {
          const device = getDevice(session.userAgent)
          const isPending = pendingToken === session.token

          return (
            <div
              key={session.id}
              className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <HugeiconsIcon icon={device.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{device.label}</p>
                  {session.isCurrent ? (
                    <Badge variant="success" className="px-2 py-0 text-[10px]">
                      Bu cihaz
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Son etkinlik {formatRelativeDate(session.updatedAt)}
                  </span>
                  {session.ipAddress ? <span>{session.ipAddress}</span> : null}
                  <span>{device.browser}</span>
                </div>
              </div>

              {!session.isCurrent ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start text-muted-foreground sm:self-auto"
                  disabled={Boolean(pendingToken) || isRevokingOthers}
                  onClick={() => void revokeSession(session.token)}
                >
                  <HugeiconsIcon
                    icon={isPending ? RefreshIcon : Logout03Icon}
                    className={`size-4 ${isPending ? "animate-spin" : ""}`}
                  />
                  {isPending ? "Kapatılıyor..." : "Oturumu kapat"}
                </Button>
              ) : null}
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
    </section>
  )
}

function getSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (message.toLowerCase().includes("fresh")) {
    return "Güvenliğiniz için yeniden giriş yaptıktan sonra bu işlemi deneyin."
  }
  return message || "Oturum işlemi tamamlanamadı."
}

function getDevice(userAgent?: string | null) {
  const value = userAgent?.toLowerCase() ?? ""
  const isMobile = /iphone|android|mobile/.test(value)
  const isTablet = /ipad|tablet/.test(value)
  const operatingSystem = value.includes("windows")
    ? "Windows"
    : value.includes("mac os") || value.includes("macintosh")
      ? "macOS"
      : value.includes("iphone") || value.includes("ipad")
        ? "iOS"
        : value.includes("android")
          ? "Android"
          : value.includes("linux")
            ? "Linux"
            : "Bilinmeyen cihaz"
  const browser = value.includes("edg/")
    ? "Microsoft Edge"
    : value.includes("chrome/")
      ? "Google Chrome"
      : value.includes("firefox/")
        ? "Mozilla Firefox"
        : value.includes("safari/")
          ? "Safari"
          : "Tarayıcı bilgisi yok"

  return {
    label: `${operatingSystem} ${isMobile ? "telefon" : isTablet ? "tablet" : "cihaz"}`,
    browser,
    icon: isMobile ? SmartPhone01Icon : isTablet ? ComputerIcon : LaptopIcon,
  }
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const differenceInMinutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60_000)
  )

  if (differenceInMinutes < 1) return "şimdi"
  if (differenceInMinutes < 60) return `${differenceInMinutes} dk önce`
  if (differenceInMinutes < 1_440) {
    return `${Math.floor(differenceInMinutes / 60)} sa önce`
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
