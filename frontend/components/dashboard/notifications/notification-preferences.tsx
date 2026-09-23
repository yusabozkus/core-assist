"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AiBrain01Icon,
  InboxIcon,
  Package01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import type {
  NotificationPreference,
  NotificationType,
} from "@/types/notification"
import { NotificationDeliverySettings } from "./notification-delivery-settings"

type PreferenceDefinition = {
  type: NotificationType
  title: string
  description: string
}

const PREFERENCE_GROUPS: Array<{
  title: string
  description: string
  icon: typeof AiBrain01Icon
  iconClassName: string
  preferences: PreferenceDefinition[]
}> = [
  {
    title: "AI ve yanıtlar",
    description: "İnceleme ve yanıt teslim süreçlerindeki önemli gelişmeler.",
    icon: AiBrain01Icon,
    iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    preferences: [
      {
        type: "AI_REVIEW_REQUIRED",
        title: "İnceleme gereken yanıtlar",
        description: "AI bir soruyu güvenle yanıtlayamadığında bildirim alın.",
      },
      {
        type: "AI_DRAFT_FAILED",
        title: "Başarısız AI taslakları",
        description:
          "Taslak üretimi kalıcı olarak başarısız olduğunda bildirin.",
      },
      {
        type: "AI_AUTOMATION_PAUSED",
        title: "Durdurulan AI otomasyonu",
        description:
          "Abonelik veya güvenlik kontrolü otomatik gönderimi durdurduğunda bildirin.",
      },
      {
        type: "ANSWER_DELIVERY_FAILED",
        title: "Gönderilemeyen yanıtlar",
        description: "Pazaryerine iletilemeyen yanıtlar için bildirim alın.",
      },
    ],
  },
  {
    title: "Senkronizasyon ve kanallar",
    description: "Katalog, soru ve kanal bağlantılarının sağlık durumu.",
    icon: RefreshIcon,
    iconClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    preferences: [
      {
        type: "PRODUCT_SYNC_FAILED",
        title: "Ürün senkronizasyonu hataları",
        description:
          "Katalog veya stok güncellemesi tamamlanamadığında bildirin.",
      },
      {
        type: "QUESTION_SYNC_FAILED",
        title: "Soru senkronizasyonu hataları",
        description: "Yeni sorular pazaryerinden alınamadığında bildirim alın.",
      },
      {
        type: "CHANNEL_CONNECTION_ERROR",
        title: "Kanal bağlantı sorunları",
        description: "Bağlı bir pazaryerinin erişimi kesildiğinde bildirin.",
      },
    ],
  },
  {
    title: "Stok uyarıları",
    description: "Satışa devam edebilmek için müdahale gerektiren stoklar.",
    icon: Package01Icon,
    iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    preferences: [
      {
        type: "LOW_STOCK",
        title: "Azalan stok",
        description:
          "Bir ürün belirlenen düşük stok eşiğine indiğinde bildirin.",
      },
      {
        type: "OUT_OF_STOCK",
        title: "Tükenen stok",
        description:
          "Bir ürünün kullanılabilir stoğu sıfıra indiğinde bildirin.",
      },
    ],
  },
]

export function NotificationPreferences({ storeId }: { storeId: string }) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTypes, setSavingTypes] = useState<Set<NotificationType>>(
    () => new Set()
  )
  const [status, setStatus] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const statusTimeoutRef = useRef<number | null>(null)

  const loadPreferences = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setStatus(null)

    try {
      const result = await getNotificationPreferences(
        storeId,
        controller.signal
      )
      if (!controller.signal.aborted) setPreferences(result.preferences)
    } catch {
      if (!controller.signal.aborted) {
        setStatus({
          type: "error",
          message: "Bildirim tercihleri alınamadı.",
        })
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }, [storeId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPreferences(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      requestRef.current?.abort()
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [loadPreferences])

  function showTemporaryStatus(type: "success" | "error", message: string) {
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current)
    }
    setStatus({ type, message })
    statusTimeoutRef.current = window.setTimeout(() => setStatus(null), 4_000)
  }

  async function handlePreferenceChange(
    type: NotificationType,
    enabled: boolean
  ) {
    if (savingTypes.has(type)) return

    const previousEnabled =
      preferences.find((preference) => preference.type === type)?.enabled ??
      true
    setPreferences((current) =>
      current.map((preference) =>
        preference.type === type ? { ...preference, enabled } : preference
      )
    )
    setSavingTypes((current) => new Set(current).add(type))

    try {
      const result = await updateNotificationPreferences(storeId, [
        { type, enabled },
      ])
      const savedPreference = result.preferences.find(
        (preference) => preference.type === type
      )
      if (savedPreference) {
        setPreferences((current) =>
          current.map((preference) =>
            preference.type === type ? savedPreference : preference
          )
        )
      }
      showTemporaryStatus("success", "Tercih kaydedildi.")
    } catch {
      setPreferences((current) =>
        current.map((preference) =>
          preference.type === type
            ? { ...preference, enabled: previousEnabled }
            : preference
        )
      )
      showTemporaryStatus(
        "error",
        "Tercih kaydedilemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setSavingTypes((current) => {
        const next = new Set(current)
        next.delete(type)
        return next
      })
    }
  }

  if (loading && preferences.length === 0) {
    return <NotificationPreferencesSkeleton />
  }

  if (preferences.length === 0) {
    return (
      <section className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/45 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={InboxIcon} className="size-5" />
        </span>
        <h2 className="mt-4 text-sm font-semibold">Tercihler alınamadı</h2>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          Bağlantınızı kontrol edip tekrar deneyin.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void loadPreferences()}
        >
          Tekrar dene
        </Button>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <NotificationDeliverySettings storeId={storeId} />

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-muted-foreground">
          Olay tercihleri bundan sonra oluşacak bildirimleri ve seçtiğiniz tüm
          teslimat kanallarını etkiler.
        </p>
        {status ? (
          <p
            className={cn(
              "shrink-0 text-xs font-medium",
              status.type === "success" ? "text-primary" : "text-destructive"
            )}
            aria-live="polite"
          >
            {status.message}
          </p>
        ) : null}
      </div>

      {PREFERENCE_GROUPS.map((group) => (
        <section
          key={group.title}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <header className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                group.iconClassName
              )}
            >
              <HugeiconsIcon icon={group.icon} className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {group.description}
              </p>
            </div>
          </header>

          <div className="divide-y divide-border">
            {group.preferences.map((definition) => {
              const preference = preferences.find(
                (candidate) => candidate.type === definition.type
              )
              const saving = savingTypes.has(definition.type)

              return (
                <div
                  key={definition.type}
                  className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {definition.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Switch
                      checked={preference?.enabled ?? true}
                      disabled={saving}
                      onCheckedChange={(checked) =>
                        void handlePreferenceChange(definition.type, checked)
                      }
                      aria-label={`${definition.title} bildirimlerini ${preference?.enabled ? "kapat" : "aç"}`}
                    />
                    {saving ? (
                      <HugeiconsIcon
                        icon={RefreshIcon}
                        className="size-3.5 animate-spin text-muted-foreground"
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function NotificationPreferencesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {PREFERENCE_GROUPS.map((group) => (
        <section
          key={group.title}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-36 rounded-md" />
              <Skeleton className="h-3 w-64 max-w-full rounded-md" />
            </div>
          </div>
          {Array.from({ length: group.preferences.length }).map(
            (_, itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0 sm:gap-5 sm:px-5"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-48 max-w-full rounded-md" />
                  <Skeleton className="h-3 w-80 max-w-full rounded-md" />
                </div>
                <Skeleton className="h-5 w-11 rounded-full" />
              </div>
            )
          )}
        </section>
      ))}
    </div>
  )
}
