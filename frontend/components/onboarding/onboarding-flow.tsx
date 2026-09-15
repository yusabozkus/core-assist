"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  ChevronDownIcon,
  InformationCircleIcon,
  Layers01Icon,
  LinkSquare02Icon,
  Logout01Icon,
  Message01Icon,
  RefreshIcon,
  Rocket01Icon,
  ShieldCheckIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { APP_ROUTES } from "@/constants/site"
import { getChannelSyncRun } from "@/lib/api/channels"
import { completeOnboarding, provisionOnboarding } from "@/lib/api/onboarding"
import { signOutCurrentUser } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import type { AuthUser } from "@/types/auth"
import type {
  AiResponseLength,
  AiTone,
  StoreKnowledge,
} from "@/types/knowledge"
import type {
  OnboardingChannel,
  OnboardingResource,
  OnboardingStatus,
} from "@/types/onboarding"

const STEPS = [
  {
    id: 1,
    label: "Mağaza",
    description: "Mağazanızı ve markanızı tanımlayın",
    icon: Store01Icon,
  },
  {
    id: 2,
    label: "Satış kanalı",
    description: "Pazaryerinizi bağlayın ve ürünleri alın",
    icon: LinkSquare02Icon,
  },
  {
    id: 3,
    label: "AI yanıtları",
    description: "Yanıt tonunu ve uzunluğunu belirleyin",
    icon: Message01Icon,
  },
] as const

const CHANNELS = [
  {
    id: "trendyol",
    name: "Trendyol",
    type: "Pazaryeri",
    credentialFields: [
      {
        key: "supplierId",
        label: "Satıcı ID",
        type: "text",
        placeholder: "Örn. 123456",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Trendyol API Key",
      },
      {
        key: "apiSecret",
        label: "API Secret",
        type: "password",
        placeholder: "Trendyol API Secret",
      },
    ],
  },
  {
    id: "hepsiburada",
    name: "Hepsiburada",
    type: "Pazaryeri",
    credentialFields: [
      {
        key: "merchantId",
        label: "Merchant ID",
        type: "text",
        placeholder: "Hepsiburada Merchant ID",
      },
      {
        key: "developerUser",
        label: "Developer User",
        type: "text",
        placeholder: "Entegrasyon kullanıcı adı",
      },
      {
        key: "serviceKey",
        label: "Servis anahtarı",
        type: "password",
        placeholder: "Hepsiburada servis anahtarı",
      },
    ],
  },
] as const

const TONE_OPTIONS: Array<{
  value: AiTone
  label: string
  description: string
}> = [
  {
    value: "PROFESSIONAL",
    label: "Profesyonel",
    description: "Kurumsal, net ve ölçülü",
  },
  {
    value: "FRIENDLY",
    label: "Samimi",
    description: "Doğal ve yaklaşılabilir",
  },
  {
    value: "WARM",
    label: "Sıcak",
    description: "İlgili ve pozitif",
  },
  {
    value: "MINIMAL",
    label: "Doğrudan",
    description: "Sade ve sonuç odaklı",
  },
]

const RESPONSE_LENGTHS: Array<{
  value: AiResponseLength
  label: string
  detail: string
}> = [
  { value: "SHORT", label: "Kısa", detail: "1–2 cümle" },
  { value: "BALANCED", label: "Dengeli", detail: "2–4 cümle" },
  { value: "DETAILED", label: "Detaylı", detail: "Gerektiğinde 3–5 cümle" },
]

type ChannelId = (typeof CHANNELS)[number]["id"]

const INITIAL_AI_PROFILE: StoreKnowledge["profile"] = {
  automationMode: "OFF",
  minimumAutoSendConfidence: 0.85,
  brandDescription: null,
  shippingPolicy: null,
  returnPolicy: null,
  exchangePolicy: null,
  warrantyPolicy: null,
  additionalInformation: null,
  tone: "PROFESSIONAL",
  responseLength: "BALANCED",
  greetingEnabled: true,
  closingEnabled: true,
  emojiPolicy: "NEVER",
  preferredEmoji: null,
}

const CATALOG_SYNC_POLL_INTERVAL_MS = 800
const CATALOG_SYNC_TIMEOUT_MS = 10 * 60 * 1_000

function waitForNextCatalogSyncPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const handleAbort = () => {
      window.clearTimeout(timeoutId)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort)
      resolve()
    }, CATALOG_SYNC_POLL_INTERVAL_MS)

    signal.addEventListener("abort", handleAbort, { once: true })
  })
}

async function waitForCatalogSync(
  storeId: string,
  syncRunId: string,
  onProgress: (progress: number) => void,
  signal: AbortSignal
) {
  const deadline = Date.now() + CATALOG_SYNC_TIMEOUT_MS

  while (Date.now() < deadline) {
    signal.throwIfAborted()

    const syncRun = await getChannelSyncRun(storeId, syncRunId, signal)
    onProgress(syncRun.progress)

    if (
      syncRun.status === "COMPLETED" ||
      (syncRun.status === "RUNNING" && syncRun.productsProcessed > 0)
    ) {
      return syncRun
    }

    if (syncRun.status === "FAILED") {
      throw new Error(
        syncRun.errorMessage ??
          "İlk katalog senkronizasyonu tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin."
      )
    }

    await waitForNextCatalogSyncPoll(signal)
  }

  throw new Error(
    "İlk katalog senkronizasyonu beklenenden uzun sürdü. Biraz sonra tekrar deneyin."
  )
}

type OnboardingFlowProps = {
  user: AuthUser
  initialStatus: OnboardingStatus
}

function getInitialStep(status: OnboardingStatus) {
  if (status.stage === "PREFERENCES") return 3
  if (status.stage === "CHANNEL" || status.stage === "SYNCING") return 2
  return 1
}

function getInitialChannel(status: OnboardingStatus): ChannelId | null {
  const providerKey = status.channelConnections[0]?.providerKey.toLowerCase()

  return CHANNELS.some((channel) => channel.id === providerKey)
    ? (providerKey as ChannelId)
    : null
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return "CA"
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR")

  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toLocaleUpperCase("tr-TR")
}

export function OnboardingFlow({ user, initialStatus }: OnboardingFlowProps) {
  const router = useRouter()
  const initialStep = getInitialStep(initialStatus)
  const [currentStep, setCurrentStep] = React.useState(initialStep)
  const [direction, setDirection] = React.useState(1)
  const [furthestStep, setFurthestStep] = React.useState(initialStep)
  const [isProvisioning, setIsProvisioning] = React.useState(
    initialStatus.stage === "SYNCING"
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [syncProgress, setSyncProgress] = React.useState(
    initialStatus.catalogSync?.progress ?? 0
  )
  const [catalogImportSummary, setCatalogImportSummary] = React.useState<{
    processed: number
    skipped: number
  } | null>(() => {
    const sync = initialStatus.catalogSync
    return sync && sync.productsSkipped > 0
      ? {
          processed: sync.productsProcessed,
          skipped: sync.productsSkipped,
        }
      : null
  })
  const [isCatalogSyncContinuing, setIsCatalogSyncContinuing] = React.useState(
    initialStatus.stage === "PREFERENCES" &&
      initialStatus.catalogSync?.status === "RUNNING" &&
      initialStatus.catalogSync.productsProcessed > 0
  )
  const [submitError, setSubmitError] = React.useState<string | null>(() =>
    initialStatus.catalogSync?.status === "FAILED"
      ? (initialStatus.catalogSync.errorMessage ??
        "İlk katalog senkronizasyonu tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.")
      : null
  )
  const syncAbortControllerRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => () => syncAbortControllerRef.current?.abort(), [])
  const [provisionedStore, setProvisionedStore] =
    React.useState<OnboardingResource | null>(
      initialStatus.stage === "PREFERENCES" ? initialStatus.store : null
    )

  const [storeName, setStoreName] = React.useState(
    initialStatus.store?.name ?? ""
  )
  const [profileDraft, setProfileDraft] = React.useState<
    StoreKnowledge["profile"]
  >(() => ({
    ...INITIAL_AI_PROFILE,
    brandDescription: initialStatus.profile?.brandDescription ?? null,
    tone: initialStatus.profile?.tone ?? INITIAL_AI_PROFILE.tone,
    responseLength:
      initialStatus.profile?.responseLength ??
      INITIAL_AI_PROFILE.responseLength,
  }))
  const [selectedChannel, setSelectedChannel] =
    React.useState<ChannelId | null>(() => getInitialChannel(initialStatus))
  const [credentials, setCredentials] = React.useState<Record<string, string>>(
    {}
  )

  const currentStepData = STEPS[currentStep - 1]
  const progress = (currentStep / STEPS.length) * 100
  const selectedChannelData = CHANNELS.find(
    (channel) => channel.id === selectedChannel
  )
  const channelCredentialsComplete = Boolean(
    selectedChannelData?.credentialFields.every((field) =>
      credentials[field.key]?.trim()
    )
  )
  const canProceed =
    currentStep === 1
      ? storeName.trim().length >= 2
      : currentStep === 2
        ? Boolean(selectedChannel && channelCredentialsComplete)
        : Boolean(provisionedStore)

  React.useEffect(() => {
    const catalogSync = initialStatus.catalogSync
    const store = initialStatus.store

    if (
      initialStatus.stage !== "SYNCING" ||
      !catalogSync ||
      catalogSync.status !== "RUNNING" ||
      !store
    ) {
      return
    }

    const controller = new AbortController()
    syncAbortControllerRef.current = controller

    void waitForCatalogSync(
      store.id,
      catalogSync.syncRunId,
      (nextProgress) => setSyncProgress(nextProgress),
      controller.signal
    )
      .then((syncRun) => {
        if (controller.signal.aborted) return

        setSyncProgress(100)
        setIsCatalogSyncContinuing(syncRun.status === "RUNNING")
        setCatalogImportSummary(
          syncRun.productsSkipped > 0
            ? {
                processed: syncRun.productsProcessed,
                skipped: syncRun.productsSkipped,
              }
            : null
        )
        setProvisionedStore(store)
        setDirection(1)
        setCurrentStep(3)
        setFurthestStep(3)
        setSubmitError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return

        setSubmitError(
          error instanceof Error
            ? error.message
            : "İlk katalog senkronizasyonu tamamlanamadı. Lütfen tekrar deneyin."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsProvisioning(false)
        if (syncAbortControllerRef.current === controller) {
          syncAbortControllerRef.current = null
        }
      })

    return () => controller.abort()
  }, [initialStatus.catalogSync, initialStatus.stage, initialStatus.store])

  const updateProfile = <Key extends keyof StoreKnowledge["profile"]>(
    key: Key,
    value: StoreKnowledge["profile"][Key]
  ) => {
    setProfileDraft((current) => ({ ...current, [key]: value }))
    setSubmitError(null)
  }

  const selectChannel = (channel: ChannelId) => {
    if (channel === selectedChannel) return
    setSelectedChannel(channel)
    setCredentials({})
    setSubmitError(null)
  }

  const goToStep = (step: number) => {
    if (
      step < 1 ||
      step > STEPS.length ||
      step > furthestStep ||
      (provisionedStore && step < 3)
    ) {
      return
    }

    setDirection(step > currentStep ? 1 : -1)
    setCurrentStep(step)
    setSubmitError(null)
  }

  const advanceToStep = (step: number) => {
    setDirection(1)
    setCurrentStep(step)
    setFurthestStep((current) => Math.max(current, step))
    setSubmitError(null)
  }

  const handleNext = async () => {
    if (!canProceed || currentStep >= STEPS.length) return

    if (currentStep === 1) {
      advanceToStep(2)
      return
    }

    await connectChannelAndSyncCatalog()
  }

  const handleBack = () => {
    if (currentStep <= 1 || provisionedStore) return

    setDirection(-1)
    setCurrentStep((step) => step - 1)
    setSubmitError(null)
  }

  const handleLogout = async () => {
    try {
      await signOutCurrentUser()
      window.location.replace(APP_ROUTES.login)
    } catch {
      setSubmitError("Çıkış yapılamadı. Lütfen tekrar deneyin.")
    }
  }

  const connectChannelAndSyncCatalog = async () => {
    if (
      !selectedChannel ||
      !selectedChannelData ||
      !channelCredentialsComplete
    ) {
      setSubmitError("Devam etmek için kanal bilgilerini eksiksiz girin.")
      return
    }

    setSyncProgress(8)
    setIsProvisioning(true)
    setSubmitError(null)

    try {
      const result = await provisionOnboarding({
        storeName: storeName.trim(),
        selectedChannel: selectedChannel.toUpperCase() as OnboardingChannel,
        environment: "PRODUCTION",
        credentials,
        brandDescription: profileDraft.brandDescription?.trim() || undefined,
        tone: profileDraft.tone,
        responseLength: profileDraft.responseLength,
      })

      const controller = new AbortController()
      syncAbortControllerRef.current = controller

      const syncRun = await waitForCatalogSync(
        result.store.id,
        result.catalogSync.syncRunId,
        (nextProgress) => setSyncProgress(nextProgress),
        controller.signal
      )

      setSyncProgress(100)
      setIsCatalogSyncContinuing(syncRun.status === "RUNNING")
      setCatalogImportSummary(
        syncRun.productsSkipped > 0
          ? {
              processed: syncRun.productsProcessed,
              skipped: syncRun.productsSkipped,
            }
          : null
      )
      setProvisionedStore(result.store)
      await new Promise((resolve) => window.setTimeout(resolve, 300))
      advanceToStep(3)
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Kanal bağlanamadı. Bilgilerinizi kontrol edip tekrar deneyin."
      )
    } finally {
      syncAbortControllerRef.current = null
      setIsProvisioning(false)
    }
  }

  const handleFinish = async () => {
    if (!provisionedStore) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await completeOnboarding({
        storeId: provisionedStore.id,
        tone: profileDraft.tone,
        responseLength: profileDraft.responseLength,
      })
      router.replace(result.nextPath)
      router.refresh()
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "AI tercihleri kaydedilemedi. Lütfen tekrar deneyin."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid min-h-dvh bg-background lg:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="commerce-panel-grid hidden min-h-dvh flex-col bg-[#10251e] px-7 py-8 text-white lg:flex xl:px-9">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[#173c2e] shadow-sm">
              <HugeiconsIcon icon={Layers01Icon} className="size-5" />
            </span>
            <div>
              <p className="text-[15px] font-bold tracking-[-0.025em]">
                Core Asistan
              </p>
              <p className="mt-0.5 text-[10px] font-medium tracking-[0.13em] text-[#91aa9e] uppercase">
                İlk kurulum
              </p>
            </div>
          </div>

          <div className="mt-14">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9bc5b0] uppercase">
              Yaklaşık 3 dakika
            </p>
            <h1 className="mt-4 text-3xl leading-[1.15] font-semibold tracking-[-0.04em]">
              Mağazanızı birlikte hazırlayalım.
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#a9bdb3]">
              Mağazanızı tanımlayacak, ilk pazaryerinizi bağlayacak ve AI’ın
              müşterilerle nasıl konuşacağını belirleyeceğiz.
            </p>
          </div>

          <nav className="mt-10 space-y-1.5" aria-label="Kurulum adımları">
            {STEPS.map((step) => {
              const isActive = step.id === currentStep
              const isCompleted = step.id < currentStep
              const isReachable =
                step.id <= furthestStep && (!provisionedStore || step.id === 3)

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={!isReachable}
                  aria-current={isActive ? "step" : undefined}
                  className="relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-[#8bbca4] focus-visible:outline-none disabled:cursor-default"
                >
                  {isActive ? (
                    <motion.span
                      layoutId="active-onboarding-step"
                      className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.08]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  ) : null}

                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                      isActive
                        ? "border-[#8bbca4] bg-[#8bbca4] text-[#10251e]"
                        : isCompleted
                          ? "border-[#4d7663] bg-[#315443] text-[#b8d5c7]"
                          : "border-white/10 bg-white/[0.03] text-[#6f8b7d]"
                    )}
                  >
                    {isCompleted ? (
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className="size-4"
                      />
                    ) : (
                      step.id
                    )}
                  </span>

                  <span className="relative z-10 min-w-0">
                    <span
                      className={cn(
                        "block text-xs font-semibold",
                        isActive
                          ? "text-white"
                          : isCompleted
                            ? "text-[#cadbd2]"
                            : "text-[#769083]"
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#71897e]">
                      {step.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-[#d9e7e0]">
                {getInitials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[#81998d]">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 -z-10 h-[44rem] w-[min(78vw,64rem)] opacity-75 blur-2xl dark:opacity-45"
            style={{
              background:
                "radial-gradient(ellipse at top right, color-mix(in oklab, var(--primary) 15%, transparent), transparent 68%)",
            }}
          />

          <header className="relative z-20 grid min-h-[76px] grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_minmax(0,1fr)] sm:gap-5 sm:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-primary uppercase">
                Adım {currentStep} / {STEPS.length}
              </p>
              <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                {currentStepData.description}
              </p>
            </div>

            <div className="flex w-full items-center justify-center gap-2.5">
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 260, damping: 32 }}
                />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Link href={APP_ROUTES.dashboard.settings.billing}>
                  Plan ve faturalama
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-bold text-secondary-foreground">
                      {getInitials(user.name)}
                    </span>
                    <span className="hidden max-w-36 truncate text-xs font-semibold sm:block">
                      {user.name}
                    </span>
                    <HugeiconsIcon
                      icon={ChevronDownIcon}
                      className="size-3.5 text-muted-foreground"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-56"
                >
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={APP_ROUTES.dashboard.settings.billing}>
                      Plan ve faturalama
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                    Oturumu kapat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle className="border border-border bg-card shadow-xs hover:bg-muted" />
            </div>
          </header>

          <main className="relative z-10 flex flex-1 items-center justify-center px-5 pt-8 pb-24 sm:px-8 sm:pt-10 sm:pb-24">
            <div className="w-full max-w-[860px]">
              <div className="flex flex-col">
                <div className="py-2 sm:py-4">
                  <AnimatePresence
                    mode="wait"
                    initial={false}
                    custom={direction}
                  >
                    <motion.div
                      key={`${currentStep}-${isProvisioning ? "sync" : "form"}`}
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -16 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {isProvisioning ? (
                        <CatalogSyncProgress
                          progress={syncProgress}
                          channelName={selectedChannelData?.name ?? "Pazaryeri"}
                        />
                      ) : currentStep === 1 ? (
                        <StoreStep
                          storeName={storeName}
                          setStoreName={setStoreName}
                          brandDescription={profileDraft.brandDescription ?? ""}
                          setBrandDescription={(value) =>
                            updateProfile("brandDescription", value || null)
                          }
                        />
                      ) : currentStep === 2 ? (
                        <ChannelStep
                          selectedChannel={selectedChannel}
                          onSelectChannel={selectChannel}
                          credentials={credentials}
                          onCredentialChange={(key, value) =>
                            setCredentials((current) => ({
                              ...current,
                              [key]: value,
                            }))
                          }
                        />
                      ) : (
                        <AiPreferencesStep
                          tone={profileDraft.tone}
                          responseLength={profileDraft.responseLength}
                          catalogImportSummary={catalogImportSummary}
                          isCatalogSyncContinuing={isCatalogSyncContinuing}
                          onToneChange={(value) => updateProfile("tone", value)}
                          onResponseLengthChange={(value) =>
                            updateProfile("responseLength", value)
                          }
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {submitError ? (
                  <div
                    className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs leading-5 text-destructive"
                    role="alert"
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>{submitError}</span>
                  </div>
                ) : null}

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={
                      currentStep === 1 ||
                      Boolean(provisionedStore) ||
                      isProvisioning ||
                      isSubmitting
                    }
                    className={
                      currentStep === 1 || provisionedStore ? "invisible" : ""
                    }
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Geri
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    onClick={
                      currentStep === STEPS.length ? handleFinish : handleNext
                    }
                    disabled={!canProceed || isProvisioning || isSubmitting}
                    className="min-w-36 px-6 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <HugeiconsIcon
                          icon={RefreshIcon}
                          className="size-4 animate-spin"
                        />
                        Kaydediliyor
                      </>
                    ) : currentStep === STEPS.length ? (
                      <>
                        <HugeiconsIcon icon={Rocket01Icon} className="size-4" />
                        Kurulumu tamamla
                      </>
                    ) : currentStep === 2 ? (
                      <>
                        Bağla ve ürünleri getir
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          className="size-4"
                        />
                      </>
                    ) : (
                      <>
                        Devam et
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          className="size-4"
                        />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </main>

          <p className="pointer-events-none fixed right-0 bottom-4 left-0 z-20 flex items-center justify-center gap-2 px-4 text-center text-[11px] text-muted-foreground lg:left-[310px] xl:left-[340px]">
            <HugeiconsIcon
              icon={ShieldCheckIcon}
              className="size-3.5 text-primary"
            />
            Bilgilerinizi daha sonra ayarlar bölümünden değiştirebilirsiniz.
          </p>
        </section>
      </div>
    </MotionConfig>
  )
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="text-[10px] font-semibold tracking-[0.13em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "text-2xl leading-tight font-semibold tracking-[-0.035em] text-foreground sm:text-[2rem]",
          eyebrow && "mt-3"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function StoreStep({
  storeName,
  setStoreName,
  brandDescription,
  setBrandDescription,
}: {
  storeName: string
  setStoreName: (value: string) => void
  brandDescription: string
  setBrandDescription: (value: string) => void
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Mağaza bilgileri"
        title="AI hangi mağaza için çalışacak?"
        description="Mağazanızı adlandırın ve AI'ın marka bağlamını anlayabilmesi için kısa bir açıklama ekleyin."
      />

      <div className="grid max-w-2xl gap-6">
        <div>
          <label
            htmlFor="store-name"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Mağaza adı <span className="text-destructive">*</span>
          </label>
          <Input
            id="store-name"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            placeholder="Örn. North Clothing"
            autoFocus
            maxLength={80}
            className="h-11 border-input bg-card px-4 shadow-xs hover:border-foreground/25 focus-visible:bg-card dark:bg-card"
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Pazaryeri mağaza adınızla aynı olabilir. Daha sonra
            değiştirebilirsiniz.
          </p>
        </div>

        <div>
          <label
            htmlFor="brand-description"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Mağazanızı kısaca tanıtın
          </label>
          <Textarea
            id="brand-description"
            value={brandDescription}
            onChange={(event) => setBrandDescription(event.target.value)}
            placeholder="(Opsiyonel) Örn. Günlük ve klasik erkek giyim ürünleri satan, sade ve ulaşılabilir bir markayız."
            maxLength={1000}
            className="min-h-28 resize-none border-input bg-card px-4 py-3 text-sm leading-6 shadow-xs hover:border-foreground/25 focus-visible:bg-card dark:bg-card"
          />
          <div className="mt-2 flex items-start justify-between gap-4 text-xs leading-5 text-muted-foreground">
            <span>
              Stok ve ürün özellikleri pazaryerinden alınır; burada yalnızca
              marka bağlamını anlatın.
            </span>
            <span className="shrink-0 tabular-nums">
              {brandDescription.length}/1000
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChannelStep({
  selectedChannel,
  onSelectChannel,
  credentials,
  onCredentialChange,
}: {
  selectedChannel: ChannelId | null
  onSelectChannel: (channel: ChannelId) => void
  credentials: Record<string, string>
  onCredentialChange: (key: string, value: string) => void
}) {
  const selected = CHANNELS.find((channel) => channel.id === selectedChannel)

  return (
    <div>
      <StepHeading
        eyebrow="Pazaryeri bağlantısı"
        title="Ürünlerinizi nereden alalım?"
        description="Pazaryerinizi seçin ve mağazanıza ait entegrasyon bilgilerini girin. Bilgileriniz şifrelenerek saklanır."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((channel) => {
          const isSelected = selectedChannel === channel.id

          return (
            <motion.button
              key={channel.id}
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectChannel(channel.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isSelected ? "bg-primary/[0.11]" : "bg-card hover:bg-muted/45"
              )}
            >
              <ProviderLogo provider={channel.id} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {channel.name}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {channel.type}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-transparent"
                )}
              >
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="size-3.5"
                />
              </span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-8 border-t border-border pt-7"
          >
            <div className="mb-5">
              <h3 className="text-base font-semibold text-foreground">
                {selected.name} bağlantı bilgileri
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Bu bilgileri {selected.name} satıcı veya entegrasyon
                panelinizden edinebilirsiniz.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {selected.credentialFields.map((field, index) => (
                <div
                  key={field.key}
                  className={cn(
                    index === selected.credentialFields.length - 1 &&
                      selected.credentialFields.length % 2 === 1 &&
                      "sm:col-span-2"
                  )}
                >
                  <label
                    htmlFor={`channel-${field.key}`}
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    {field.label}
                  </label>
                  <Input
                    id={`channel-${field.key}`}
                    type={field.type}
                    value={credentials[field.key] ?? ""}
                    onChange={(event) =>
                      onCredentialChange(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    autoComplete="off"
                    className="h-11 border-input bg-card px-4 shadow-xs hover:border-foreground/25 focus-visible:bg-card dark:bg-card"
                  />
                </div>
              ))}
            </div>

            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={ShieldCheckIcon}
                className="size-4 text-primary"
              />
              Kimlik bilgileriniz yalnızca pazaryeri bağlantısı için kullanılır.
            </p>
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-sm text-muted-foreground"
          >
            Devam etmek için bir pazaryeri seçin.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function CatalogSyncProgress({
  progress,
  channelName,
}: {
  progress: number
  channelName: string
}) {
  const status =
    progress < 28
      ? "Bağlantı doğrulanıyor"
      : progress < 68
        ? "Ürünleriniz çekiliyor"
        : progress < 100
          ? "Varyant ve stok bilgileri hazırlanıyor"
          : "İlk senkronizasyon başlatıldı"

  return (
    <div className="mx-auto flex min-h-[430px] w-full max-w-xl flex-col items-center justify-center text-center">
      <span className="relative flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/10" />
        {progress === 100 ? (
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            className="relative size-7"
          />
        ) : (
          <HugeiconsIcon
            icon={RefreshIcon}
            className="relative size-7 animate-spin"
          />
        )}
      </span>
      <p className="mt-6 text-[10px] font-semibold tracking-[0.13em] text-primary uppercase">
        {channelName}
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">
        Ürünlerinizi hazırlıyoruz
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">{status}</p>

      <div className="mt-8 w-full">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>İlk katalog senkronizasyonu</span>
          <span className="font-medium text-foreground tabular-nums">
            %{progress}
          </span>
        </div>
      </div>
    </div>
  )
}

function AiPreferencesStep({
  tone,
  responseLength,
  catalogImportSummary,
  isCatalogSyncContinuing,
  onToneChange,
  onResponseLengthChange,
}: {
  tone: AiTone
  responseLength: AiResponseLength
  catalogImportSummary: { processed: number; skipped: number } | null
  isCatalogSyncContinuing: boolean
  onToneChange: (value: AiTone) => void
  onResponseLengthChange: (value: AiResponseLength) => void
}) {
  const lengthIndex = Math.max(
    0,
    RESPONSE_LENGTHS.findIndex((option) => option.value === responseLength)
  )
  const selectedLength = RESPONSE_LENGTHS[lengthIndex]

  return (
    <div>
      <StepHeading
        eyebrow="AI yanıt tercihleri"
        title="AI müşterilerinizle nasıl konuşsun?"
        description="Başlangıç için yalnızca iletişim tonunu ve hedef yanıt uzunluğunu seçin. Daha ayrıntılı kuralları panelden ekleyebilirsiniz."
      />

      {isCatalogSyncContinuing ? (
        <div className="mb-7 flex max-w-3xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/6 px-4 py-3 text-xs leading-5">
          <HugeiconsIcon
            icon={RefreshIcon}
            className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
          />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              İlk ürünleriniz hazır.
            </span>{" "}
            Kataloğunuzun kalanı arka planda aktarılıyor. Kurulumu tamamlayıp
            paneli kullanmaya başlayabilirsiniz.
          </p>
        </div>
      ) : null}

      {catalogImportSummary ? (
        <div className="mb-7 flex max-w-3xl items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs leading-5">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {catalogImportSummary.processed.toLocaleString("tr-TR")} ürün
              kataloğunuza eklendi.
            </span>{" "}
            {catalogImportSummary.skipped.toLocaleString("tr-TR")} ürün plan
            kapasitesi nedeniyle beklemede. Kuruluma devam edebilir, daha sonra
            planınızı yükselterek kalan ürünleri alabilirsiniz.
          </p>
        </div>
      ) : null}

      <div className="max-w-3xl divide-y divide-border">
        <section className="pb-8">
          <h3 className="text-sm font-semibold text-foreground">Yanıt tonu</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Müşteriye verilen yanıtların genel iletişim karakterini belirler.
          </p>
          <div
            role="radiogroup"
            aria-label="Yanıt tonu"
            className="mt-4 grid gap-2 sm:grid-cols-2"
          >
            {TONE_OPTIONS.map((option) => {
              const selected = tone === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onToneChange(option.value)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    selected ? "bg-primary/10 shadow-xs" : "hover:bg-muted/45"
                  )}
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      selected ? "bg-primary" : "bg-border"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </section>

        <section className="pt-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Yanıt uzunluğu
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                AI, gerekli bilgiyi seçtiğiniz hedef uzunlukta aktarır.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-foreground">
                {selectedLength.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedLength.detail}
              </p>
            </div>
          </div>

          <div className="mt-7 px-1">
            <Slider
              value={[lengthIndex]}
              min={0}
              max={RESPONSE_LENGTHS.length - 1}
              step={1}
              onValueChange={([index]) => {
                const option = RESPONSE_LENGTHS[index]
                if (option) onResponseLengthChange(option.value)
              }}
              aria-label="Yanıt uzunluğu"
            />
            <div className="mt-3 grid grid-cols-3 text-xs text-muted-foreground">
              {RESPONSE_LENGTHS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onResponseLengthChange(option.value)}
                  className={cn(
                    "rounded-sm py-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    index === 0 && "text-left",
                    index === 1 && "text-center",
                    index === 2 && "text-right",
                    responseLength === option.value &&
                      "font-medium text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
