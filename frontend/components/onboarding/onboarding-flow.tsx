"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  ChevronDownIcon,
  Edit02Icon,
  InformationCircleIcon,
  Layers01Icon,
  LinkSquare02Icon,
  Logout01Icon,
  Rocket01Icon,
  ShieldCheckIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_ROUTES } from "@/constants/site"
import { completeOnboarding } from "@/lib/api/onboarding"
import { signOutCurrentUser } from "@/lib/auth-client"
import type { AuthUser } from "@/types/auth"
import type { OnboardingChannel } from "@/types/onboarding"

const STEPS = [
  {
    id: 1,
    label: "Mağaza",
    description: "Satış noktanızı tanımlayın",
    icon: Store01Icon,
  },
  {
    id: 2,
    label: "Satış kanalı",
    description: "İlk entegrasyonu planlayın",
    icon: LinkSquare02Icon,
  },
  {
    id: 3,
    label: "Son kontrol",
    description: "Kurulumu gözden geçirin",
    icon: CheckmarkCircle01Icon,
  },
] as const

const CHANNELS = [
  {
    id: "trendyol",
    name: "Trendyol",
    type: "Pazaryeri",
    image: "/merchants/trendyol.webp",
    available: true,
  },
  {
    id: "hepsiburada",
    name: "Hepsiburada",
    type: "Pazaryeri",
    image: "/merchants/hepsiburada.webp",
    available: true,
  },
] as const

type ChannelId = (typeof CHANNELS)[number]["id"]

type OnboardingFlowProps = {
  user: AuthUser
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return "CA"
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR")

  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toLocaleUpperCase("tr-TR")
}

export function OnboardingFlow({ user }: OnboardingFlowProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState(1)
  const [direction, setDirection] = React.useState(1)
  const [furthestStep, setFurthestStep] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [storeName, setStoreName] = React.useState("")
  const [selectedChannel, setSelectedChannel] =
    React.useState<ChannelId | null>("trendyol")

  const currentStepData = STEPS[currentStep - 1]
  const progress = (currentStep / STEPS.length) * 100
  const selectedChannelData = CHANNELS.find(
    (channel) => channel.id === selectedChannel
  )

  const canProceed = currentStep !== 1 || storeName.trim().length >= 2

  const goToStep = (step: number) => {
    if (step < 1 || step > STEPS.length || step > furthestStep) return

    setDirection(step > currentStep ? 1 : -1)
    setCurrentStep(step)
    setSubmitError(null)
  }

  const handleNext = () => {
    if (!canProceed || currentStep >= STEPS.length) return

    const nextStep = currentStep + 1
    setDirection(1)
    setCurrentStep(nextStep)
    setFurthestStep((step) => Math.max(step, nextStep))
    setSubmitError(null)
  }

  const handleBack = () => {
    if (currentStep <= 1) return

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

  const handleFinish = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await completeOnboarding({
        storeName: storeName.trim(),
        selectedChannel: selectedChannel
          ? (selectedChannel.toLocaleUpperCase("en-US") as OnboardingChannel)
          : undefined,
      })

      router.replace(APP_ROUTES.dashboard.root)
      router.refresh()
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Kurulum tamamlanamadı. Lütfen tekrar deneyin."
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
                CoreAssist
              </p>
              <p className="mt-0.5 text-[10px] font-medium tracking-[0.13em] text-[#91aa9e] uppercase">
                İlk kurulum
              </p>
            </div>
          </div>

          <div className="mt-14">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9bc5b0] uppercase">
              Yaklaşık 2 dakika
            </p>
            <h1 className="mt-4 text-3xl leading-[1.15] font-semibold tracking-[-0.04em]">
              Mağazanızı birlikte hazırlayalım.
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#a9bdb3]">
              Önce temel yapıyı kuracağız. Entegrasyon ve gelişmiş ayarları daha
              sonra panelden tamamlayabilirsiniz.
            </p>
          </div>

          <nav className="mt-10 space-y-1.5" aria-label="Kurulum adımları">
            {STEPS.map((step) => {
              const isActive = step.id === currentStep
              const isCompleted = step.id < currentStep
              const isReachable = step.id <= furthestStep

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={!isReachable}
                  aria-current={isActive ? "step" : undefined}
                  className="relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-[#8bbca4] focus-visible:outline-none disabled:cursor-default"
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-onboarding-step"
                      className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.08]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}

                  <span
                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
                      isActive
                        ? "border-[#8bbca4] bg-[#8bbca4] text-[#10251e]"
                        : isCompleted
                          ? "border-[#4d7663] bg-[#315443] text-[#b8d5c7]"
                          : "border-white/10 bg-white/[0.03] text-[#6f8b7d]"
                    }`}
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
                      className={`block text-xs font-semibold ${
                        isActive
                          ? "text-white"
                          : isCompleted
                            ? "text-[#cadbd2]"
                            : "text-[#769083]"
                      }`}
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

        <section className="flex min-h-dvh flex-col">
          <header className="flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-xl sm:px-8 lg:justify-end">
            <div className="flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <HugeiconsIcon icon={Layers01Icon} className="size-4.5" />
              </span>
              <span className="text-sm font-bold tracking-[-0.02em]">
                CoreAssist
              </span>
            </div>

            <div className="flex items-center gap-2">
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
                  className="w-56 rounded-xl p-1.5"
                >
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer gap-2 rounded-lg p-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                    Oturumu kapat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle className="border border-border bg-card shadow-xs hover:bg-muted" />
            </div>
          </header>

          <div className="border-b border-border bg-card/45 px-5 py-3 sm:px-8 lg:hidden">
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <span>{currentStepData.label}</span>
              <span>
                {currentStep} / {STEPS.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 32 }}
              />
            </div>
          </div>

          <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12 xl:py-16">
            <div className="w-full max-w-[780px]">
              <div className="mb-6 hidden items-center justify-between lg:flex">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.13em] text-primary uppercase">
                    Adım {currentStep} / {STEPS.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {currentStepData.description}
                  </p>
                </div>
                <div className="flex w-44 items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${progress}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 32,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_55px_-34px_rgba(23,32,29,0.35)]">
                <div className="min-h-[420px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
                  <AnimatePresence
                    mode="wait"
                    initial={false}
                    custom={direction}
                  >
                    <motion.div
                      key={currentStep}
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 26 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -18 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {currentStep === 1 && (
                        <StoreStep
                          storeName={storeName}
                          setStoreName={setStoreName}
                        />
                      )}
                      {currentStep === 2 && (
                        <ChannelStep
                          selectedChannel={selectedChannel}
                          setSelectedChannel={setSelectedChannel}
                        />
                      )}
                      {currentStep === 3 && (
                        <ReviewStep
                          storeName={storeName}
                          channelName={selectedChannelData?.name}
                          onEdit={goToStep}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {submitError && (
                  <div
                    className="mx-5 mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-xs leading-5 text-destructive sm:mx-8 lg:mx-10"
                    role="alert"
                  >
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:px-8 lg:px-10">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isSubmitting}
                    className={currentStep === 1 ? "invisible" : ""}
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
                    disabled={!canProceed || isSubmitting}
                    className="min-w-32 rounded-xl px-6 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                        Hazırlanıyor
                      </>
                    ) : currentStep === STEPS.length ? (
                      <>
                        <HugeiconsIcon icon={Rocket01Icon} className="size-4" />
                        Kurulumu tamamla
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

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
                <HugeiconsIcon
                  icon={ShieldCheckIcon}
                  className="size-3.5 text-primary"
                />
                Bilgilerinizi daha sonra ayarlar bölümünden değiştirebilirsiniz.
              </p>
            </div>
          </main>
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
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-semibold tracking-[0.13em] text-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-[-0.035em] text-foreground sm:text-[2rem]">
        {title}
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function StoreStep({
  storeName,
  setStoreName,
}: {
  storeName: string
  setStoreName: (value: string) => void
}) {
  return (
    <div>
      <StepHeading
        eyebrow="İlk satış noktası"
        title="İlk mağazanızı oluşturun"
        description="Bağlayacağınız pazaryeri ve mesaj kanalları bu mağaza altında birlikte yönetilecek."
      />

      <div className="">
        <label
          htmlFor="store-name"
          className="mb-2 block text-xs font-semibold text-foreground"
        >
          Mağaza adı
        </label>
        <Input
          id="store-name"
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="Örn. North Clothing"
          autoFocus
          className="h-13 rounded-xl bg-background px-4 text-sm"
        />
      </div>

      <div className="mt-6 rounded-xl border border-primary/15 bg-primary/[0.045] p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <HugeiconsIcon icon={Store01Icon} className="size-4 text-primary" />
          Birden fazla mağaza yönetebilirsiniz
        </p>
        <p className="mt-1.5 pl-6 text-[11px] leading-5 text-muted-foreground">
          İlk mağazayı şimdi oluşturun; diğer mağazaları panelden istediğiniz
          zaman ekleyebilirsiniz.
        </p>
      </div>
    </div>
  )
}

function ChannelStep({
  selectedChannel,
  setSelectedChannel,
}: {
  selectedChannel: ChannelId | null
  setSelectedChannel: (channel: ChannelId | null) => void
}) {
  return (
    <div>
      <StepHeading
        eyebrow="Entegrasyon planı"
        title="Önce hangi kanalı bağlayacaksınız?"
        description="Seçiminizi kurulumdan sonra entegrasyon ekranında tamamlayabilirsiniz. Bu adım şimdilik yalnızca çalışma sıranızı belirler."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CHANNELS.map((channel) => {
          const isSelected = selectedChannel === channel.id

          return (
            <motion.button
              key={channel.id}
              type="button"
              whileTap={channel.available ? { scale: 0.985 } : undefined}
              onClick={() =>
                channel.available && setSelectedChannel(channel.id)
              }
              disabled={!channel.available}
              className={`relative min-h-40 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                isSelected
                  ? "border-primary bg-primary/[0.055]"
                  : channel.available
                    ? "border-border bg-background hover:border-primary/35 hover:bg-muted/35"
                    : "cursor-not-allowed border-border/70 bg-muted/30"
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="selected-channel"
                  className="absolute inset-0 rounded-xl ring-1 ring-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex items-start justify-between">
                <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-white shadow-xs">
                  <Image
                    src={channel.image}
                    alt={`${channel.name} logosu`}
                    width={48}
                    height={48}
                    className="size-full object-cover"
                  />
                </span>
                {isSelected ? (
                  <HugeiconsIcon
                    icon={CheckmarkCircle01Icon}
                    className="size-5 text-primary"
                  />
                ) : !channel.available ? (
                  <span className="rounded-md bg-muted px-2 py-1 text-[8px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                    Yakında
                  </span>
                ) : null}
              </span>
              <span className="relative mt-4 block text-xs font-semibold text-foreground">
                {channel.name}
              </span>
              <span className="relative mt-1 block text-[10px] text-muted-foreground">
                {channel.type}
              </span>
            </motion.button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setSelectedChannel(null)}
        className={`mt-4 text-xs font-medium transition-colors ${
          selectedChannel === null
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Şimdilik kanal seçmeden devam et
      </button>
    </div>
  )
}

function ReviewStep({
  storeName,
  channelName,
  onEdit,
}: {
  storeName: string
  channelName?: string
  onEdit: (step: number) => void
}) {
  const items = [
    {
      label: "Mağaza",
      value: storeName,
      detail: "Satış ve operasyon merkeziniz",
      icon: Store01Icon,
      step: 1,
    },
    {
      label: "İlk kanal",
      value: channelName ?? "Daha sonra seçilecek",
      detail: channelName
        ? "Bağlantı panelde tamamlanacak"
        : "Kurulumdan sonra eklenebilir",
      icon: LinkSquare02Icon,
      step: 2,
    },
  ]

  return (
    <div>
      <StepHeading
        eyebrow="Hazırsınız"
        title="Kurulumu son kez kontrol edin"
        description="Mağazanız şimdi oluşturulacak. Entegrasyon bağlantısını panelde güvenle tamamlayabilirsiniz."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.22 }}
            className="flex min-h-40 flex-col rounded-xl border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <HugeiconsIcon icon={item.icon} className="size-4" />
              </span>
              <button
                type="button"
                onClick={() => onEdit(item.step)}
                aria-label={`${item.label} bilgisini düzenle`}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
              </button>
            </div>
            <p className="mt-5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {item.value}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              {item.detail}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4">
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        <div>
          <p className="text-xs font-semibold text-foreground">
            Temel kurulum tamamlanacak
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            Ekip üyeleri, ek mağazalar ve otomasyon tercihleri dashboard
            üzerinden daha sonra yapılandırılabilir.
          </p>
        </div>
      </div>
    </div>
  )
}
