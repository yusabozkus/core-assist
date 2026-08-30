"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckmarkCircle01Icon,
  Delete02Icon,
  Package01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChannelBadge } from "@/components/dashboard/channels/channel-badge"
import { ChannelCard } from "@/components/dashboard/channels/channel-card"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import { getProvider } from "@/components/dashboard/channels/channel-utils"
import {
  configureChannelConnection,
  createChannelConnection,
  disconnectChannelConnection,
  reconnectChannelConnection,
  removeChannelConnection,
  syncChannelCatalog,
  syncChannelInventory,
} from "@/lib/api/channels"
import type {
  ChannelConnection,
  IntegrationEnvironment,
  IntegrationProvider,
} from "@/types/channel"

export type ChannelManagementProps = {
  storeId: string
  storeName: string
  connections: ChannelConnection[]
  providers: IntegrationProvider[]
}

type PendingAction = {
  connectionId: string
  type: "disconnect" | "reconnect" | "sync" | "inventory-sync"
} | null

export function ChannelManagement({
  storeId,
  storeName,
  connections,
  providers,
}: ChannelManagementProps) {
  const router = useRouter()
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
  const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(
    null
  )
  const [configuringConnection, setConfiguringConnection] =
    useState<ChannelConnection | null>(null)
  const [environment, setEnvironment] =
    useState<IntegrationEnvironment>("SANDBOX")
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [connectionToRemove, setConnectionToRemove] =
    useState<ChannelConnection | null>(null)
  const [isSavingConnection, setIsSavingConnection] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isUpdating, startUpdateTransition] = useTransition()

  const connectedProviderKeys = new Set(
    connections.map((connection) => connection.providerKey)
  )
  const selectedProvider = providers.find(
    (provider) =>
      provider.key ===
      (configuringConnection?.providerKey ?? selectedProviderKey)
  )
  const removalProvider = connectionToRemove
    ? getProvider(providers, connectionToRemove.providerKey)
    : null
  const connectedCount = connections.filter(
    (connection) => connection.status === "CONNECTED"
  ).length
  const syncedCount = connections.filter(
    (connection) => connection.lastSyncAt
  ).length
  const hasRunningSync = connections.some(
    (connection) => connection.processingStartedAt
  )

  useEffect(() => {
    if (!hasRunningSync) return

    const intervalId = window.setInterval(() => router.refresh(), 2_000)
    return () => window.clearInterval(intervalId)
  }, [hasRunningSync, router])

  function selectProvider(provider: IntegrationProvider) {
    setSelectedProviderKey(provider.key)
    setCredentials({})
    setEnvironment(provider.environments[0] ?? "SANDBOX")
    setDialogError(null)
  }

  function openConfiguration(connection: ChannelConnection) {
    setConfiguringConnection(connection)
    setSelectedProviderKey(connection.providerKey)
    setEnvironment(connection.environment)
    setCredentials({})
    setDialogError(null)
    setIsConnectionDialogOpen(true)
  }

  async function saveConnection() {
    if (!selectedProvider) {
      setDialogError("Bağlamak istediğiniz pazaryerini seçin.")
      return
    }

    const missingField = selectedProvider.credentialFields.find(
      (field) => !credentials[field.key]?.trim()
    )

    if (missingField) {
      setDialogError(`${missingField.label} alanı zorunludur.`)
      return
    }

    setIsSavingConnection(true)
    setDialogError(null)
    setActionError(null)
    setMessage(null)

    try {
      if (configuringConnection) {
        await configureChannelConnection(storeId, configuringConnection.id, {
          environment,
          credentials,
        })
        setMessage(`${selectedProvider.name} bağlantısı güncellendi.`)
      } else {
        await createChannelConnection(storeId, {
          providerKey: selectedProvider.key,
          environment,
          credentials,
        })
        setMessage(`${selectedProvider.name} mağazaya bağlandı.`)
      }

      resetConnectionDialog()
      router.refresh()
    } catch (caughtError) {
      setDialogError(
        caughtError instanceof Error
          ? caughtError.message
          : "Pazaryeri bağlantısı kaydedilemedi."
      )
    } finally {
      setIsSavingConnection(false)
    }
  }

  function runConnectionAction(
    connection: ChannelConnection,
    action: "disconnect" | "reconnect" | "sync" | "inventory-sync"
  ) {
    if (isUpdating) return

    const provider = getProvider(providers, connection.providerKey)
    setPendingAction({ connectionId: connection.id, type: action })
    setActionError(null)
    setMessage(null)

    startUpdateTransition(async () => {
      try {
        if (action === "disconnect") {
          await disconnectChannelConnection(storeId, connection.id)
          setMessage(`${provider.name} bağlantısı devre dışı bırakıldı.`)
        } else if (action === "reconnect") {
          await reconnectChannelConnection(storeId, connection.id)
          setMessage(`${provider.name} bağlantısı yeniden doğrulandı.`)
        } else if (action === "sync") {
          await syncChannelCatalog(storeId, connection.id)
          setMessage(`${provider.name} ürün senkronizasyonu kuyruğa alındı.`)
        } else {
          await syncChannelInventory(storeId, connection.id)
          setMessage(`${provider.name} stok kontrolü kuyruğa alındı.`)
        }

        router.refresh()
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error
            ? caughtError.message
            : "İşlem tamamlanamadı."
        )
      } finally {
        setPendingAction(null)
      }
    })
  }

  async function removeConnection() {
    if (!connectionToRemove || !removalProvider) return

    setIsRemoving(true)
    setDialogError(null)
    setActionError(null)
    setMessage(null)

    try {
      await removeChannelConnection(storeId, connectionToRemove.id)
      setConnectionToRemove(null)
      setMessage(`${removalProvider.name} bağlantısı kaldırıldı.`)
      router.refresh()
    } catch (caughtError) {
      setDialogError(
        caughtError instanceof Error
          ? caughtError.message
          : "Pazaryeri bağlantısı kaldırılamadı."
      )
    } finally {
      setIsRemoving(false)
    }
  }

  function handleConnectionDialogChange(open: boolean) {
    if (!open && isSavingConnection) return

    if (open) {
      setIsConnectionDialogOpen(true)
      return
    }

    resetConnectionDialog()
  }

  function resetConnectionDialog() {
    setIsConnectionDialogOpen(false)
    setConfiguringConnection(null)
    setSelectedProviderKey(null)
    setEnvironment("SANDBOX")
    setCredentials({})
    setDialogError(null)
  }

  function handleRemoveDialogChange(open: boolean) {
    if (!open && isRemoving) return

    if (!open) {
      setConnectionToRemove(null)
      setDialogError(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Satış kanalları
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {storeName} mağazasının pazaryeri bağlantılarını ve ürün
            senkronizasyonlarını yönetin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChannelBadge label="Pazaryeri" value={connections.length} />
            <ChannelBadge label="Bağlı" value={connectedCount} />
            <ChannelBadge label="Senkronize" value={syncedCount} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:self-center">
          <Button asChild type="button" variant="outline">
            <Link href={APP_ROUTES.dashboard.catalog.products}>
              <HugeiconsIcon icon={Package01Icon} className="size-4" />
              Ürün kataloğu
            </Link>
          </Button>
          <ResponsiveDialog
            open={isConnectionDialogOpen}
            onOpenChange={handleConnectionDialogChange}
            title={
              configuringConnection
                ? `${selectedProvider?.name ?? "Pazaryeri"} bağlantısını yapılandır`
                : "Pazaryeri bağla"
            }
            description="Mağaza erişim bilgileri şifrelenerek saklanır ve hiçbir API cevabında geri gönderilmez."
            contentClassName="sm:max-w-2xl"
            trigger={
              <Button type="button">
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                Pazaryeri bağla
              </Button>
            }
            footer={({ close }) => (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={isSavingConnection}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  onClick={saveConnection}
                  disabled={!selectedProvider || isSavingConnection}
                >
                  {isSavingConnection
                    ? "Doğrulanıyor..."
                    : configuringConnection
                      ? "Bağlantıyı güncelle"
                      : "Bağlantıyı doğrula"}
                </Button>
              </>
            )}
          >
            {!configuringConnection ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((provider) => {
                  const isAlreadyAdded = connectedProviderKeys.has(provider.key)
                  const isSelected = selectedProviderKey === provider.key

                  return (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => selectProvider(provider)}
                      disabled={isAlreadyAdded || isSavingConnection}
                      aria-pressed={isSelected}
                      className={`flex min-h-28 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-primary/35 hover:bg-muted/40"
                      }`}
                    >
                      <ProviderLogo provider={provider} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {provider.name}
                          </span>
                          {isSelected ? (
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              className="size-4 shrink-0 text-primary"
                            />
                          ) : null}
                        </span>
                        <span className="mt-2 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                          {isAlreadyAdded
                            ? "Bu pazaryeri zaten mağazaya bağlı."
                            : provider.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {selectedProvider ? (
              <div className={configuringConnection ? "" : "mt-6"}>
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-muted/35 p-3">
                  <ProviderLogo provider={selectedProvider} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedProvider.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Güvenli API bağlantısı
                    </p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="connection-environment">Ortam</Label>
                    <Select
                      value={environment}
                      onValueChange={(value) =>
                        setEnvironment(value as IntegrationEnvironment)
                      }
                      disabled={isSavingConnection}
                    >
                      <SelectTrigger
                        id="connection-environment"
                        className="h-11 w-full rounded-xl border-border bg-background"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProvider.environments.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value === "SANDBOX"
                              ? "Test / Sandbox"
                              : "Production / Canlı"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProvider.credentialFields.map((field) => (
                    <div key={field.key} className="grid gap-2">
                      <Label htmlFor={`credential-${field.key}`}>
                        {field.label}
                      </Label>
                      <Input
                        id={`credential-${field.key}`}
                        name={field.key}
                        type={field.type}
                        value={credentials[field.key] ?? ""}
                        onChange={(event) =>
                          setCredentials((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                        autoComplete="off"
                        disabled={isSavingConnection}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 min-h-5 text-sm" aria-live="polite">
              {dialogError ? (
                <p className="text-destructive">{dialogError}</p>
              ) : null}
            </div>
          </ResponsiveDialog>
        </div>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Bağlantılar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ürün kataloğunu besleyen pazaryeri bağlantıları
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={PlusSignIcon} className="size-5" />
            </span>
            <h3 className="mt-5 font-semibold text-foreground">
              Henüz pazaryeri bağlanmadı
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Trendyol veya Hepsiburada bağlantısı kurarak ürün kataloğunuzu
              içeri aktarabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connections.map((connection) => (
              <ChannelCard
                key={connection.id}
                connection={connection}
                provider={getProvider(providers, connection.providerKey)}
                pendingAction={
                  pendingAction?.connectionId === connection.id
                    ? pendingAction.type
                    : null
                }
                actionsDisabled={isUpdating || isRemoving || isSavingConnection}
                onConfigure={openConfiguration}
                onAction={runConnectionAction}
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
        title={`${removalProvider?.name ?? "Pazaryeri"} kaldırılsın mı?`}
        description="Bağlantı ve senkronizasyon geçmişi mağazadan kaldırılacak. İçeri aktarılan katalog ürünleri korunur."
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
              onClick={removeConnection}
              disabled={isRemoving}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              {isRemoving ? "Kaldırılıyor..." : "Bağlantıyı kaldır"}
            </Button>
          </>
        )}
      >
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-muted-foreground">
          Şifrelenmiş API bilgileri kalıcı olarak silinecektir. Pazaryeri
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
