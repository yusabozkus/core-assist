import {
  Delete02Icon,
  RefreshIcon,
  Settings02Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ConnectionStatusBadge } from "@/components/dashboard/channels/connection-status-badge"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Button } from "@/components/ui/button"
import type { ChannelConnection, IntegrationProvider } from "@/types/channel"

export type ChannelAction =
  "disconnect" | "reconnect" | "sync" | "inventory-sync"

type ChannelCardProps = {
  connection: ChannelConnection
  provider: IntegrationProvider
  pendingAction: ChannelAction | null
  actionsDisabled: boolean
  onConfigure: (connection: ChannelConnection) => void
  onAction: (connection: ChannelConnection, action: ChannelAction) => void
  onRemove: (connection: ChannelConnection) => void
}

const channelDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
})

export function ChannelCard({
  connection,
  provider,
  pendingAction,
  actionsDisabled,
  onConfigure,
  onAction,
  onRemove,
}: ChannelCardProps) {
  const canDisconnect = connection.status === "CONNECTED"
  const canReconnect =
    connection.status === "DISCONNECTED" || connection.status === "ERROR"

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-row items-center gap-2">
          <ProviderLogo provider={provider} />
          <div>
            <h3 className="font-semibold text-foreground">{provider.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {connection.environment === "SANDBOX"
                ? "Test ortamı"
                : "Canlı ortam"}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-end">
          {connection.status !== "PENDING" ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground"
              aria-label={`${provider.name} bağlantısını yapılandır`}
              onClick={() => onConfigure(connection)}
              disabled={actionsDisabled}
            >
              <HugeiconsIcon
                icon={Settings02Icon}
                className="size-3.5"
                strokeWidth={2}
              />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive! hover:text-white"
            aria-label={`${provider.name} bağlantısını kaldır`}
            disabled={actionsDisabled}
            onClick={() => onRemove(connection)}
          >
            <HugeiconsIcon
              icon={Delete02Icon}
              className="size-4"
              strokeWidth={2}
            />
          </Button>
        </div>
      </div>
      <div className="mt-2 mb-4">
        <ConnectionStatusBadge
          status={connection.status}
          isSyncing={Boolean(connection.processingStartedAt)}
        />
      </div>
      <div>
        <p className="text-sm leading-6 text-muted-foreground">
          {provider.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {(connection.lastInventorySyncAt ?? connection.lastSyncAt)
            ? `Son stok kontrolü: ${channelDateFormatter.format(new Date(connection.lastInventorySyncAt ?? connection.lastSyncAt!))}`
            : "Henüz ürün senkronizasyonu yapılmadı."}
        </p>
        {connection.failureReason ? (
          <p className="mt-2 line-clamp-2 text-xs text-destructive">
            {connection.failureReason}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connection.status === "PENDING" ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onConfigure(connection)}
            disabled={actionsDisabled}
          >
            <HugeiconsIcon icon={Settings02Icon} className="size-3.5" />
            Kurulumu tamamla
          </Button>
        ) : null}
        {connection.status === "CONNECTED" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAction(connection, "inventory-sync")}
            disabled={
              actionsDisabled || Boolean(connection.processingStartedAt)
            }
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            {pendingAction === "inventory-sync"
              ? "Kontrol ediliyor..."
              : "Stokları güncelle"}
          </Button>
        ) : null}
        {connection.status === "CONNECTED" ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onAction(connection, "sync")}
            disabled={
              actionsDisabled || Boolean(connection.processingStartedAt)
            }
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            {pendingAction === "sync" || connection.processingStartedAt
              ? "Senkronize ediliyor..."
              : "Tam katalog çek"}
          </Button>
        ) : null}
        {canDisconnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            onClick={() => onAction(connection, "disconnect")}
          >
            <HugeiconsIcon icon={Unlink01Icon} className="size-3.5" />
            {pendingAction === "disconnect"
              ? "Güncelleniyor..."
              : "Devre dışı bırak"}
          </Button>
        ) : null}
        {canReconnect ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            onClick={() => onAction(connection, "reconnect")}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            {pendingAction === "reconnect"
              ? "Doğrulanıyor..."
              : "Yeniden bağla"}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
