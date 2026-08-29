"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Delete02Icon,
  PlusSignIcon,
  RefreshIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { CHANNEL_CATALOG, getChannelCatalogItem } from "@/constants/channels"
import {
  createChannelConnection,
  disconnectChannelConnection,
  reconnectChannelConnection,
  removeChannelConnection,
} from "@/lib/api/channels"
import type {
  ChannelConnection,
  ChannelConnectionStatus,
  ChannelProvider,
} from "@/types/channel"

type ChannelManagementProps = {
  storeId: string
  connections: ChannelConnection[]
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

export function ChannelManagement({
  storeId,
  connections,
}: ChannelManagementProps) {
  const router = useRouter()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] =
    useState<ChannelProvider | null>(null)
  const [connectionToRemove, setConnectionToRemove] =
    useState<ChannelConnection | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [pendingConnectionId, setPendingConnectionId] = useState<string | null>(
    null
  )
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isUpdating, startUpdateTransition] = useTransition()

  const connectedProviderIds = new Set(
    connections.map((connection) => connection.provider)
  )
  const connectedCount = connections.filter(
    (connection) => connection.status === "CONNECTED"
  ).length
  const pendingCount = connections.filter(
    (connection) => connection.status === "PENDING"
  ).length
  const removalChannel = connectionToRemove
    ? getChannelCatalogItem(connectionToRemove.provider)
    : null

  async function handleCreate() {
    if (!selectedProvider) {
      setDialogError("Bağlamak istediğiniz satış kanalını seçin.")
      return
    }

    setIsCreating(true)
    setDialogError(null)
    setActionError(null)
    setMessage(null)

    try {
      const connection = await createChannelConnection(storeId, {
        provider: selectedProvider,
      })
      const channel = getChannelCatalogItem(connection.provider)

      setIsAddDialogOpen(false)
      setSelectedProvider(null)
      setMessage(`${channel.name} bağlantısı kurulum sırasına eklendi.`)
      router.refresh()
    } catch (caughtError) {
      setDialogError(
        caughtError instanceof Error
          ? caughtError.message
          : "Satış kanalı eklenemedi."
      )
    } finally {
      setIsCreating(false)
    }
  }

  function handleConnectionUpdate(
    connection: ChannelConnection,
    action: "disconnect" | "reconnect"
  ) {
    if (isUpdating) return

    const channel = getChannelCatalogItem(connection.provider)
    setPendingConnectionId(connection.id)
    setActionError(null)
    setMessage(null)

    startUpdateTransition(async () => {
      try {
        if (action === "disconnect") {
          await disconnectChannelConnection(storeId, connection.id)
          setMessage(`${channel.name} bağlantısı devre dışı bırakıldı.`)
        } else {
          await reconnectChannelConnection(storeId, connection.id)
          setMessage(`${channel.name} yeniden bağlantı sırasına alındı.`)
        }

        router.refresh()
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error
            ? caughtError.message
            : "Kanal durumu güncellenemedi."
        )
      } finally {
        setPendingConnectionId(null)
      }
    })
  }

  async function handleRemove() {
    if (!connectionToRemove || !removalChannel) return

    setIsRemoving(true)
    setDialogError(null)
    setActionError(null)
    setMessage(null)

    try {
      await removeChannelConnection(storeId, connectionToRemove.id)
      setConnectionToRemove(null)
      setMessage(`${removalChannel.name} bağlantısı kaldırıldı.`)
      router.refresh()
    } catch (caughtError) {
      setDialogError(
        caughtError instanceof Error
          ? caughtError.message
          : "Satış kanalı kaldırılamadı."
      )
    } finally {
      setIsRemoving(false)
    }
  }

  function handleAddDialogChange(open: boolean) {
    if (!open && isCreating) return

    setIsAddDialogOpen(open)
    setDialogError(null)

    if (!open) {
      setSelectedProvider(null)
    }
  }

  function handleRemoveDialogChange(open: boolean) {
    if (!open && isRemoving) return

    if (!open) {
      setConnectionToRemove(null)
      setDialogError(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ChannelMetric label="Eklenen kanal" value={connections.length} />
          <ChannelMetric label="Bağlı" value={connectedCount} />
          <ChannelMetric label="Kurulum bekliyor" value={pendingCount} />
        </div>

        <ResponsiveDialog
          open={isAddDialogOpen}
          onOpenChange={handleAddDialogChange}
          title="Satış kanalı ekle"
          description="Mağazanıza bağlamak istediğiniz kanalı seçin. Bağlantı bilgilerini sonraki kurulum adımında tamamlayabilirsiniz."
          contentClassName="sm:max-w-2xl"
          trigger={
            <Button type="button">
              <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              Kanal ekle
            </Button>
          }
          footer={({ close }) => (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={isCreating}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!selectedProvider || isCreating}
              >
                {isCreating ? "Ekleniyor..." : "Kanalı ekle"}
              </Button>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNEL_CATALOG.map((channel) => {
              const isAlreadyAdded = connectedProviderIds.has(channel.provider)
              const isSelected = selectedProvider === channel.provider

              return (
                <button
                  key={channel.provider}
                  type="button"
                  onClick={() => setSelectedProvider(channel.provider)}
                  disabled={isAlreadyAdded || isCreating}
                  aria-pressed={isSelected}
                  className={`flex min-h-32 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background hover:border-primary/35 hover:bg-muted/40"
                  }`}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-xs">
                    <Image
                      src={channel.image}
                      alt={`${channel.name} logosu`}
                      width={48}
                      height={48}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {channel.name}
                      </span>
                      {isSelected ? (
                        <HugeiconsIcon
                          icon={CheckmarkCircle01Icon}
                          className="size-4 shrink-0 text-primary"
                        />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {isAlreadyAdded ? "Zaten eklendi" : channel.category}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                      {channel.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 min-h-5 text-sm" aria-live="polite">
            {dialogError ? (
              <p className="text-destructive">{dialogError}</p>
            ) : null}
          </div>
        </ResponsiveDialog>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Bağlı kanallar
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu mağaza için eklenen entegrasyonlar
            </p>
          </div>
        </div>

        {connections.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={PlusSignIcon} className="size-5" />
            </span>
            <h3 className="mt-5 font-semibold text-foreground">
              Henüz satış kanalı eklenmedi
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              İlk entegrasyonunuzu ekleyerek sipariş ve mesaj akışınızı bu
              mağazada toplamaya başlayın.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <ChannelCard
                key={connection.id}
                connection={connection}
                isPending={pendingConnectionId === connection.id}
                actionsDisabled={isUpdating || isRemoving || isCreating}
                onUpdate={handleConnectionUpdate}
                onRemove={setConnectionToRemove}
              />
            ))}
          </div>
        )}

        <div className="mt-4 min-h-6 text-sm" aria-live="polite">
          {actionError ? (
            <p className="text-destructive">{actionError}</p>
          ) : null}
          {message ? (
            <p className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <ResponsiveDialog
        open={Boolean(connectionToRemove)}
        onOpenChange={handleRemoveDialogChange}
        title={`${removalChannel?.name ?? "Satış kanalı"} kaldırılsın mı?`}
        description="Kanal bağlantısı ve mevcut kurulum durumu bu mağazadan kaldırılacak."
        contentClassName="sm:max-w-md"
        footer={({ close }) => (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isRemoving}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              {isRemoving ? "Kaldırılıyor..." : "Bağlantıyı kaldır"}
            </Button>
          </>
        )}
      >
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-muted-foreground">
          Bu işlem kanalın CoreAssist üzerindeki bağlantı kaydını siler. Kanal
          hesabınızdaki veriler etkilenmez.
        </div>
        <div className="mt-4 min-h-5 text-sm" aria-live="polite">
          {dialogError ? (
            <p className="text-destructive">{dialogError}</p>
          ) : null}
        </div>
      </ResponsiveDialog>
    </div>
  )
}

function ChannelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ChannelCard({
  connection,
  isPending,
  actionsDisabled,
  onUpdate,
  onRemove,
}: {
  connection: ChannelConnection
  isPending: boolean
  actionsDisabled: boolean
  onUpdate: (
    connection: ChannelConnection,
    action: "disconnect" | "reconnect"
  ) => void
  onRemove: (connection: ChannelConnection) => void
}) {
  const channel = getChannelCatalogItem(connection.provider)
  const canDisconnect = connection.status === "CONNECTED"
  const canReconnect =
    connection.status === "DISCONNECTED" || connection.status === "ERROR"

  return (
    <article className="flex min-h-64 flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-xs">
          <Image
            src={channel.image}
            alt={`${channel.name} logosu`}
            width={48}
            height={48}
            className="size-full object-cover"
          />
        </span>
        <ConnectionStatusBadge status={connection.status} />
      </div>

      <div className="mt-5">
        <h3 className="font-semibold text-foreground">{channel.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {channel.category} ·{" "}
          {dateFormatter.format(new Date(connection.createdAt))}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {channel.description}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
        {canDisconnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            onClick={() => onUpdate(connection, "disconnect")}
          >
            <HugeiconsIcon icon={Unlink01Icon} className="size-3.5" />
            {isPending ? "Güncelleniyor..." : "Devre dışı bırak"}
          </Button>
        ) : null}
        {canReconnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            onClick={() => onUpdate(connection, "reconnect")}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            {isPending ? "Güncelleniyor..." : "Yeniden bağla"}
          </Button>
        ) : null}
        {connection.status === "PENDING" ? (
          <span className="text-xs text-muted-foreground">
            Kurulum bilgileri bekleniyor
          </span>
        ) : null}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-destructive"
          aria-label={`${channel.name} bağlantısını kaldır`}
          disabled={actionsDisabled}
          onClick={() => onRemove(connection)}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </Button>
      </div>
    </article>
  )
}

function ConnectionStatusBadge({
  status,
}: {
  status: ChannelConnectionStatus
}) {
  if (status === "CONNECTED") {
    return <Badge variant="success">Bağlı</Badge>
  }

  if (status === "PENDING") {
    return <Badge variant="warning">Kurulum bekliyor</Badge>
  }

  if (status === "ERROR") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/25 text-destructive"
      >
        Hata
      </Badge>
    )
  }

  return <Badge variant="secondary">Devre dışı</Badge>
}
