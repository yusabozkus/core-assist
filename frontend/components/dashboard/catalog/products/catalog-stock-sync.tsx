"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loading03Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { getChannelSyncRun, syncChannelInventory } from "@/lib/api/channels"
import { cn } from "@/lib/utils"
import type { ChannelConnection } from "@/types/channel"
import { getProviderName } from "./product-catalog-utils"

type CatalogStockSyncProps = {
  storeId: string
  connections: ChannelConnection[]
  provider: string
  onCompleted: () => void
}

export function CatalogStockSync({
  storeId,
  connections,
  provider,
  onCompleted,
}: CatalogStockSyncProps) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [runIds, setRunIds] = useState<string[]>([])
  const [completed, setCompleted] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [activeSyncScope, setActiveSyncScope] = useState<string | null>(null)
  const [lastCompletedSync, setLastCompletedSync] = useState<{
    scope: string
    completedAt: string
  } | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [pollAttempt, setPollAttempt] = useState(0)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const observingExternal = useRef(false)
  const channels = connections.filter(
    (connection) =>
      connection.type === "COMMERCE" &&
      connection.status === "CONNECTED" &&
      (provider === "ALL" || provider === connection.providerKey)
  )
  const busy = starting || runIds.length > 0
  const externallySyncing = channels.some(
    (connection) => connection.processingStartedAt
  )
  const isSyncing = busy || externallySyncing
  const latestConnectionSync = channels
    .map(
      (connection) => connection.lastInventorySyncAt ?? connection.lastSyncAt
    )
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const localSyncMatchesProvider =
    lastCompletedSync &&
    (provider === "ALL" ||
      lastCompletedSync.scope === "ALL" ||
      lastCompletedSync.scope === provider)
  const lastSyncAt = [
    latestConnectionSync,
    localSyncMatchesProvider ? lastCompletedSync.completedAt : null,
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function startSync() {
    if (inFlight.current || busy || externallySyncing || channels.length === 0)
      return
    inFlight.current = true
    setStarting(true)
    setMessage(null)
    setQueueError(null)
    setPollError(null)
    setCompleted(0)
    setActiveSyncScope(provider)
    const results = await Promise.allSettled(
      channels.map((connection) => syncChannelInventory(storeId, connection.id))
    )
    if (!mounted.current) return
    const queued = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value.syncRunId] : []
    )
    const failed = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [getProviderName(channels[index].providerKey)]
        : []
    )
    if (failed.length)
      setQueueError(`${failed.join(", ")}: stok kontrolü başlatılamadı.`)
    if (queued.length === 0) setActiveSyncScope(null)
    setRunIds(queued)
    setStarting(false)
    inFlight.current = false
    router.refresh()
  }

  useEffect(() => {
    if (runIds.length === 0) return
    const controller = new AbortController()
    let timer: number | undefined
    let failures = 0

    async function poll() {
      try {
        const runs = await Promise.all(
          runIds.map((id) =>
            getChannelSyncRun(
              storeId,
              id,
              AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
            )
          )
        )
        if (controller.signal.aborted) return
        failures = 0
        setPollError(null)
        setCompleted(runs.filter((run) => run.status !== "RUNNING").length)
        if (runs.some((run) => run.status === "RUNNING")) {
          timer = window.setTimeout(poll, 2_000)
          return
        }
        const failed = runs.filter((run) => run.status === "FAILED")
        const successful = runs.filter((run) => run.status === "COMPLETED")
        if (failed.length) {
          const names = failed
            .map((run) => getProviderName(run.providerKey))
            .join(", ")
          setQueueError((current) =>
            [current, `${names}: stok kontrolü tamamlanamadı.`]
              .filter(Boolean)
              .join(" ")
          )
        }
        if (successful.length) {
          const variants = successful.reduce(
            (sum, run) => sum + run.variantsProcessed,
            0
          )
          setMessage(
            `${variants.toLocaleString("tr-TR")} varyantın stok bilgisi güncellendi.`
          )
          const completedAt = successful
            .map((run) => run.completedAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1)
          setLastCompletedSync({
            scope: activeSyncScope ?? provider,
            completedAt: completedAt ?? new Date().toISOString(),
          })
        }
        setRunIds([])
        setActiveSyncScope(null)
        onCompleted()
        router.refresh()
      } catch {
        if (controller.signal.aborted) return
        failures += 1
        if (failures < 3) timer = window.setTimeout(poll, 3_000)
        else setPollError("İşlem durumu alınamadı. Kontrolü yeniden deneyin.")
      }
    }
    void poll()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [
    runIds,
    storeId,
    onCompleted,
    router,
    pollAttempt,
    activeSyncScope,
    provider,
  ])

  useEffect(() => {
    if (!message || isSyncing) return

    const timeout = window.setTimeout(() => setMessage(null), 5_000)
    return () => window.clearTimeout(timeout)
  }, [isSyncing, message])

  // Follow a sync started elsewhere, including after reloading this page.
  useEffect(() => {
    if (busy) return
    if (!externallySyncing) {
      if (observingExternal.current) {
        observingExternal.current = false
        onCompleted()
      }
      return
    }
    observingExternal.current = true
    const timer = window.setInterval(() => router.refresh(), 3_000)
    return () => window.clearInterval(timer)
  }, [externallySyncing, busy, onCompleted, router])

  return (
    <div className="flex flex-col items-start gap-2 sm:max-w-sm sm:items-end">
      <Button
        type="button"
        size="sm"
        className="h-10 px-4"
        disabled={busy || externallySyncing || channels.length === 0}
        onClick={startSync}
      >
        <HugeiconsIcon
          icon={isSyncing ? Loading03Icon : RefreshIcon}
          className={cn("size-4", isSyncing && "animate-spin")}
        />
        {isSyncing ? "Stoklar güncelleniyor" : "Stokları güncelle"}
      </Button>
      <div
        aria-live="polite"
        className="text-xs leading-5 text-muted-foreground sm:text-right"
      >
        {isSyncing && !pollError ? (
          <p>
            Stok bilgileri güncelleniyor
            {runIds.length > 1
              ? ` · ${completed} / ${runIds.length} kanal`
              : ""}
          </p>
        ) : message ? (
          <p className="inline-flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
            <HugeiconsIcon
              icon={Tick02Icon}
              className="mt-0.5 size-3.5 shrink-0"
            />
            {message}
          </p>
        ) : lastSyncAt ? (
          <p>Son stok kontrolü {formatSyncDate(lastSyncAt)}</p>
        ) : (
          <p>
            {channels.length === 0
              ? "Güncellenebilecek bağlı kanal yok"
              : "Henüz stok kontrolü yapılmadı"}
          </p>
        )}
        {queueError ? (
          <p className="text-destructive">
            {queueError}{" "}
            <Link
              href={APP_ROUTES.dashboard.channels.sync}
              className="underline underline-offset-2"
            >
              Senkron geçmişi
            </Link>
          </p>
        ) : null}
        {pollError ? (
          <p className="text-destructive">
            {pollError}{" "}
            <button
              type="button"
              onClick={() => {
                setPollError(null)
                setPollAttempt((current) => current + 1)
              }}
              className="font-medium underline underline-offset-2"
            >
              Tekrar kontrol et
            </button>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}
