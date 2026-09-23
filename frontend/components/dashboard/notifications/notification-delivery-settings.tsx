"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Clock01Icon,
  ComputerIcon,
  Mail01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  getNotificationDeliverySettings,
  getWebPushPublicKey,
  saveWebPushSubscription,
  updateNotificationDeliverySettings,
} from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import type { NotificationDeliverySettings as DeliverySettings } from "@/types/notification"

export function NotificationDeliverySettings({ storeId }: { storeId: string }) {
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const statusTimeoutRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const result = await getNotificationDeliverySettings(
        storeId,
        controller.signal
      )
      if (!controller.signal.aborted) setSettings(result)
    } catch {
      if (!controller.signal.aborted) {
        setStatus({ type: "error", message: "Teslimat ayarları alınamadı." })
      }
    }
  }, [storeId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timeoutId)
      requestRef.current?.abort()
      if (statusTimeoutRef.current)
        window.clearTimeout(statusTimeoutRef.current)
    }
  }, [load])

  function showStatus(type: "success" | "error", message: string) {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current)
    setStatus({ type, message })
    statusTimeoutRef.current = window.setTimeout(() => setStatus(null), 4_000)
  }

  async function save(
    key: keyof Pick<
      DeliverySettings,
      | "browserEnabled"
      | "emailEnabled"
      | "quietHoursEnabled"
      | "quietHoursStart"
      | "quietHoursEnd"
    >,
    value: boolean | string
  ) {
    if (!settings || saving) return
    const previous = settings
    setSaving(key)
    setSettings({ ...settings, [key]: value })

    try {
      const result = await updateNotificationDeliverySettings(storeId, {
        [key]: value,
      })
      setSettings(result)
      showStatus("success", "Teslimat ayarı kaydedildi.")
    } catch (error) {
      setSettings(previous)
      showStatus(
        "error",
        error instanceof Error ? error.message : "Ayar kaydedilemedi."
      )
    } finally {
      setSaving(null)
    }
  }

  async function handleBrowserChange(enabled: boolean) {
    if (!settings || saving) return
    if (!enabled) {
      await save("browserEnabled", false)
      return
    }

    setSaving("browserEnabled")
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Bu tarayıcı push bildirimlerini desteklemiyor.")
      }
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Tarayıcı bildirim izni verilmedi.")
      }

      const { configured, publicKey } = await getWebPushPublicKey()
      if (!configured || !publicKey) {
        throw new Error("Tarayıcı bildirimleri sunucuda yapılandırılmadı.")
      }

      const registration = await navigator.serviceWorker.register(
        "/notification-sw.js"
      )
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicKey),
        }))
      await saveWebPushSubscription(storeId, subscription)
      const result = await updateNotificationDeliverySettings(storeId, {
        browserEnabled: true,
      })
      setSettings(result)
      showStatus("success", "Bu tarayıcı için bildirimler açıldı.")
    } catch (error) {
      showStatus(
        "error",
        error instanceof Error ? error.message : "Bildirim izni alınamadı."
      )
    } finally {
      setSaving(null)
    }
  }

  if (!settings) {
    return <DeliverySettingsSkeleton />
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">Teslimat kanalları</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Uygulama içi kayda ek olarak kritik gelişmeleri nereden almak
            istediğinizi seçin.
          </p>
        </div>
        {status ? (
          <p
            className={cn(
              "text-xs font-medium",
              status.type === "success" ? "text-primary" : "text-destructive"
            )}
            aria-live="polite"
          >
            {status.message}
          </p>
        ) : null}
      </header>

      <div className="divide-y divide-border">
        <DeliveryRow
          icon={ComputerIcon}
          title="Tarayıcı bildirimleri"
          description={
            settings.availability.browser
              ? "Core Asistan kapalıyken de bu cihazda kritik uyarıları görün."
              : "Sunucuda VAPID anahtarları yapılandırıldığında kullanılabilir."
          }
          checked={settings.browserEnabled}
          disabled={!settings.availability.browser || Boolean(saving)}
          loading={saving === "browserEnabled"}
          onCheckedChange={(checked) => void handleBrowserChange(checked)}
        />
        <DeliveryRow
          icon={Mail01Icon}
          title="E-posta bildirimleri"
          description={
            settings.availability.email
              ? "Kritik mağaza olaylarını hesabınızdaki e-posta adresine gönderir."
              : "Resend bilgileri yapılandırıldığında kullanılabilir."
          }
          checked={settings.emailEnabled}
          disabled={!settings.availability.email || Boolean(saving)}
          loading={saving === "emailEnabled"}
          onCheckedChange={(checked) => void save("emailEnabled", checked)}
        />

        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 sm:gap-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <HugeiconsIcon icon={Clock01Icon} className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Sessiz saatler</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Bu aralıkta e-posta ve tarayıcı teslimatı durur; bildirimler
                  uygulama içinde görünmeye devam eder.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.quietHoursEnabled}
              disabled={Boolean(saving)}
              onCheckedChange={(checked) =>
                void save("quietHoursEnabled", checked)
              }
              aria-label="Sessiz saatleri aç veya kapat"
            />
          </div>

          {settings.quietHoursEnabled ? (
            <div className="mt-4 grid max-w-sm grid-cols-2 gap-2 sm:gap-3 sm:pl-12">
              <TimeField
                label="Başlangıç"
                value={settings.quietHoursStart}
                disabled={Boolean(saving)}
                onChange={(value) => void save("quietHoursStart", value)}
              />
              <TimeField
                label="Bitiş"
                value={settings.quietHoursEnd}
                disabled={Boolean(saving)}
                onChange={(value) => void save("quietHoursEnd", value)}
              />
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Saat dilimi: {settings.timezone}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function DeliveryRow({
  icon,
  title,
  description,
  checked,
  disabled,
  loading,
  onCheckedChange,
}: {
  icon: typeof ComputerIcon
  title: string
  description: string
  checked: boolean
  disabled: boolean
  loading: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:gap-5 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HugeiconsIcon icon={icon} className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-label={`${title} ${checked ? "kapat" : "aç"}`}
        />
        {loading ? (
          <HugeiconsIcon
            icon={RefreshIcon}
            className="size-3.5 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>
    </div>
  )
}

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5 text-xs font-medium">
      <span>{label}</span>
      <Input
        type="time"
        value={value}
        disabled={disabled}
        className="bg-background"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function DeliverySettingsSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="space-y-2 border-b border-border px-5 py-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-0"
        >
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-5 w-11 rounded-full" />
        </div>
      ))}
    </section>
  )
}

function decodeVapidPublicKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/")
  const bytes = window.atob(base64)
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}
