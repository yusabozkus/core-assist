"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Delete02Icon,
  Package01Icon,
  PlugSocketIcon,
  PlusSignIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChannelCard } from "@/components/dashboard/channels/channel-card"
import {
  GuidedSpotlightTour,
  type GuidedTourStep,
} from "@/components/dashboard/setup/response-settings-tour"
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
  const searchParams = useSearchParams()
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
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
  const availableProviders = providers.filter(
    (provider) => !connectedProviderKeys.has(provider.key)
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
  const attentionCount = connections.filter(
    (connection) =>
      connection.status !== "CONNECTED" ||
      connection.failureReason ||
      connection.questionSyncFailureReason
  ).length
  const syncingCount = connections.filter(
    (connection) =>
      connection.processingStartedAt || connection.questionSyncStartedAt
  ).length
  const hasRunningSync = connections.some(
    (connection) =>
      connection.processingStartedAt || connection.questionSyncStartedAt
  )
  const firstConnectionStatus = connections[0]?.status

  useEffect(() => {
    if (searchParams.get("setupGuideTour") !== "1") return
    const url = new URL(window.location.href)
    url.searchParams.delete("setupGuideTour")
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
    window.requestAnimationFrame(() => {
      setTourStep(0)
      setTourOpen(true)
    })
  }, [searchParams])

  const tourSteps = useMemo<GuidedTourStep[]>(
    () => [
      {
        targets: ["[data-channel-tour-connect]"],
        title: "Yeni kanal ekleyin",
        description: availableProviders.length
          ? "Kanal bağla düğmesiyle yeni bir pazaryeri ekleyebilirsiniz. Alttaki uygun pazaryeri kartlarından da aynı işlemi başlatabilirsiniz."
          : "Desteklenen kanalların tümü bağlı. Yeni bir kanal kullanılabilir olduğunda ekleme düğmesi burada görünür.",
      },
      ...(connections.length
        ? [
            {
              targets: [
                "[data-channel-tour-menu-trigger]",
                "[data-channel-tour-menu]",
              ],
              title: "Bağlantı işlemleri",
              description:
                firstConnectionStatus === "PENDING"
                  ? "Üç nokta menüsünden henüz tamamlanmamış bağlantıyı kaldırabilirsiniz. Kurulumu tamamla düğmesiyle bağlantı bilgilerini girebilirsiniz."
                  : firstConnectionStatus === "CONNECTED"
                    ? "Üç nokta menüsünden bağlantı ayarlarını açabilir, kanalı devre dışı bırakabilir veya kaldırabilirsiniz. Kaldırma işlemini ayrıca onaylamanız gerekir."
                    : "Üç nokta menüsünden bağlantı ayarlarını açabilir veya kanalı kaldırabilirsiniz. Kaldırma işlemini ayrıca onaylamanız gerekir.",
            },
            {
              targets: ["[data-channel-tour-actions]"],
              title: "Güncelleme düğmeleri",
              description:
                firstConnectionStatus === "PENDING"
                  ? "Kurulumu tamamla düğmesi bağlantı bilgilerini açar. Bağlandıktan sonra katalog ve stok güncelleme düğmeleri burada görünür."
                  : firstConnectionStatus === "CONNECTED"
                    ? "Kataloğu güncelle ve Stokları güncelle düğmeleri veri akışını başlatır. Geçmiş bağlantısı yapılan işlemleri gösterir."
                    : "Yeniden bağla düğmesi bağlantıyı doğrular. Bağlantı düzeldiğinde katalog ve stok güncelleme düğmeleri burada görünür.",
            },
          ]
        : [
            {
              targets: ["[data-channel-tour-empty]"],
              title: "Kanallarınız burada görünür",
              description:
                "Bir kanal bağladığınızda bağlantı durumu, ürün ve stok güncellemeleri bu alanda görünür.",
            },
          ]),
    ],
    [availableProviders.length, connections.length, firstConnectionStatus]
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

  function openProviderDialog(provider: IntegrationProvider) {
    setConfiguringConnection(null)
    selectProvider(provider)
    setIsConnectionDialogOpen(true)
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
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 truncate text-xs font-medium text-muted-foreground">
            {storeName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bağlı Kanallar
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Pazaryeri bağlantılarınızı ve veri akışını tek yerden yönetin.
          </p>
        </div>

        <div
          data-channel-tour-connect={
            availableProviders.length === 0 ? "" : undefined
          }
          className={`grid gap-2 sm:flex sm:flex-wrap sm:items-center ${availableProviders.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={
              availableProviders.length
                ? "col-span-2 justify-self-end sm:col-span-1"
                : "justify-self-end"
            }
            onClick={() => {
              setTourStep(0)
              setTourOpen(true)
            }}
          >
            Kısa tur
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="w-full bg-card sm:w-auto"
          >
            <Link href={APP_ROUTES.dashboard.channels.sync}>
              <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
              <span className="sm:hidden">Geçmiş</span>
              <span className="hidden sm:inline">Senkron geçmişi</span>
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
            description="Pazaryeri erişim bilgileri şifrelenerek saklanır."
            contentClassName="sm:max-w-2xl"
            trigger={
              availableProviders.length > 0 ? (
                <Button
                  data-channel-tour-connect=""
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                  Kanal bağla
                </Button>
              ) : undefined
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
                {availableProviders.map((provider) => {
                  const isSelected = selectedProviderKey === provider.key

                  return (
                    <button
                      key={provider.key}
                      type="button"
                      onClick={() => selectProvider(provider)}
                      disabled={isSavingConnection}
                      aria-pressed={isSelected}
                      className={`flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
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
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                          {provider.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {selectedProvider ? (
              <div className={configuringConnection ? "" : "mt-6"}>
                {configuringConnection ? (
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
                ) : null}

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
      </header>

      <section
        aria-label="Bağlantı özeti"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-xs"
      >
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:px-4 sm:shadow-none sm:first:pl-0 sm:last:pr-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={PlugSocketIcon} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-none font-semibold tabular-nums">
              {connectedCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Bağlı kanal</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:px-4 sm:shadow-none sm:first:pl-0 sm:last:pr-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-none font-semibold tabular-nums">
              {attentionCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              İşlem gerektiren
            </p>
          </div>
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs sm:col-span-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:px-4 sm:shadow-none sm:first:pl-0 sm:last:pr-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-none font-semibold tabular-nums">
              {syncingCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Süren senkronizasyon
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Pazaryerleri
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ürün, stok ve soru güncellemelerini kanal bazında takip edin.
            </p>
          </div>
          {connections.length > 0 ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={APP_ROUTES.dashboard.catalog.products}>
                <HugeiconsIcon icon={Package01Icon} className="size-3.5" />
                Ürünlere git
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </Button>
          ) : null}
        </div>

        {connections.length === 0 ? (
          <div
            data-channel-tour-empty=""
            className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={PlugSocketIcon} className="size-5" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Henüz bağlı kanal yok
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              İlk pazaryerinizi aşağıdan seçerek ürünlerinizi ve sorularınızı
              içeri aktarın.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {connections.map((connection, index) => (
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
                tourTarget={index === 0}
                tourMenuOpen={tourOpen && tourStep === 1 && index === 0}
              />
            ))}
          </div>
        )}

        <div className="mt-4 text-sm" aria-live="polite">
          {actionError ? (
            <p role="alert" className="text-destructive">
              {actionError}
            </p>
          ) : null}
          {message ? (
            <p className="inline-flex items-center gap-2 text-primary">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
              {message}
            </p>
          ) : null}
        </div>
      </section>

      {availableProviders.length > 0 ? (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Yeni kanal ekle
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mağazanızda henüz kullanılmayan pazaryerleri
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {availableProviders.map((provider) => (
              <button
                key={provider.key}
                type="button"
                onClick={() => openProviderDialog(provider)}
                className="group flex min-w-0 items-center gap-3.5 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-primary/[0.02] focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ProviderLogo
                  provider={provider}
                  className="size-11 rounded-lg"
                  sizes="44px"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {provider.name}
                  </span>
                  <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
                    {provider.description}
                  </span>
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ResponsiveDialog
        open={Boolean(connectionToRemove)}
        onOpenChange={handleRemoveDialogChange}
        title={`${removalProvider?.name ?? "Pazaryeri"} kaldırılsın mı?`}
        description="API bilgileri ve yalnızca bu kanaldan gelen katalog verileri kalıcı olarak silinecek. Soru ve cevap geçmişiniz korunacak."
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
          Başka bir bağlı pazaryerinde karşılığı bulunan ürünler korunur.
          Yalnızca bu kanala ait ürünler, varyantlar ve beden tabloları silinir.
          Pazaryeri hesabınızdaki veriler etkilenmez.
        </div>
        <div className="mt-4 min-h-5 text-sm" aria-live="polite">
          {dialogError ? (
            <p className="text-destructive">{dialogError}</p>
          ) : null}
        </div>
      </ResponsiveDialog>

      {tourOpen ? (
        <GuidedSpotlightTour
          eyebrow="Bağlı kanallar"
          steps={tourSteps}
          onClose={() => setTourOpen(false)}
          onStepChange={setTourStep}
        />
      ) : null}
    </div>
  )
}
