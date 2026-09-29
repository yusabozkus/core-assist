"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AiSparklesIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { APP_ROUTES } from "@/constants/site"
import { getStoreKnowledge } from "@/lib/api/knowledge"
import { getProductQuestions } from "@/lib/api/questions"
import {
  getSetupGuideState,
  updateSetupGuideState,
} from "@/lib/api/setup-guide"
import type { SetupGuideState, SetupGuideUpdate } from "@/lib/api/setup-guide"
import {
  getSetupGuidePreviewProgress,
  getSetupGuideProgress,
  initialSetupGuidePreviewState,
} from "@/lib/setup-guide"
import type {
  SetupGuidePreviewState,
  SetupGuideProgress,
} from "@/lib/setup-guide"
import type { StoreKnowledge } from "@/types/knowledge"
import type { ProductQuestionPage } from "@/types/question"

type Snapshot = {
  knowledge: StoreKnowledge
  questions: ProductQuestionPage["summary"] | null
}

type GuideAction = {
  id:
    | "AI"
    | "STORE"
    | "CELEBRATE"
    | "CHANNELS"
    | "TEAM"
    | "FAQ"
    | "INBOX"
    | "DONE"
  title: string
  description: string
  href?: string
  cta?: string
  optional: boolean
}

function readLegacyGuideState(
  value: string | null
): Pick<SetupGuideState, "phase" | "aiSettingsVisited" | "skippedFaq"> {
  if (value === "dismissed")
    return { phase: "done", skippedFaq: false, aiSettingsVisited: false }
  if (!value)
    return { phase: "essential", skippedFaq: false, aiSettingsVisited: false }
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "phase" in parsed &&
      (parsed.phase === "essential" ||
        parsed.phase === "optional" ||
        parsed.phase === "done")
    ) {
      return {
        phase: parsed.phase,
        skippedFaq: "skippedFaq" in parsed && parsed.skippedFaq === true,
        aiSettingsVisited:
          "aiSettingsVisited" in parsed && parsed.aiSettingsVisited === true,
      }
    }
  } catch {
    // Malformed local data should never block the guide.
  }
  return { phase: "essential", skippedFaq: false, aiSettingsVisited: false }
}

function readPreviewState(value: string | null): SetupGuidePreviewState | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "phase" in parsed &&
      (parsed.phase === "essential" ||
        parsed.phase === "optional" ||
        parsed.phase === "done")
    ) {
      return {
        phase: parsed.phase,
        aiSettingsVisited:
          "aiSettingsVisited" in parsed && parsed.aiSettingsVisited === true,
        storeVisited: "storeVisited" in parsed && parsed.storeVisited === true,
        faqVisited: "faqVisited" in parsed && parsed.faqVisited === true,
        inboxVisited: "inboxVisited" in parsed && parsed.inboxVisited === true,
        channelsVisited:
          "channelsVisited" in parsed && parsed.channelsVisited === true,
        teamVisited: "teamVisited" in parsed && parsed.teamVisited === true,
        skippedFaq: "skippedFaq" in parsed && parsed.skippedFaq === true,
      }
    }
  } catch {
    // Ignore an invalid preview session.
  }
  return null
}

export function SetupGuide({
  storeId,
  userId,
  canManageTeam,
}: {
  storeId: string
  userId: string
  canManageTeam: boolean
}) {
  const pathname = usePathname()
  const hiddenForConversation = pathname.startsWith(
    `${APP_ROUTES.dashboard.support}/tickets/`
  )
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [guideState, setGuideState] = useState<SetupGuideState | null>(null)
  const [previewState, setPreviewState] =
    useState<SetupGuidePreviewState | null>(null)
  const [error, setError] = useState(false)
  const [actionError, setActionError] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [open, setOpen] = useState(false)
  const [lastOpenedActionId, setLastOpenedActionId] = useState<
    GuideAction["id"] | null
  >(null)
  const [visibleBubbleKey, setVisibleBubbleKey] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const aiVisitInFlight = useRef(false)
  const storageKey = `coreassist-setup-guide:${userId}:${storeId}`
  const previewKey = `${storageKey}:preview`
  const effectiveState = previewState ?? guideState
  const finished = effectiveState?.phase === "done"

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const url = new URL(window.location.href)
    const command = url.searchParams.get("setupGuidePreview")
    let nextPreview: SetupGuidePreviewState | null
    if (command === "1") {
      window.sessionStorage.setItem(
        previewKey,
        JSON.stringify(initialSetupGuidePreviewState)
      )
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith(`${previewKey}:bubble:`)) {
          window.sessionStorage.removeItem(key)
        }
      }
      nextPreview = initialSetupGuidePreviewState
    } else if (command === "0") {
      window.sessionStorage.removeItem(previewKey)
      nextPreview = null
    } else {
      nextPreview = readPreviewState(window.sessionStorage.getItem(previewKey))
    }
    if (command === "1" || command === "0") {
      url.searchParams.delete("setupGuidePreview")
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      )
    }
    const timeout = window.setTimeout(() => setPreviewState(nextPreview), 0)
    return () => window.clearTimeout(timeout)
  }, [previewKey])

  function savePreviewState(next: SetupGuidePreviewState) {
    window.sessionStorage.setItem(previewKey, JSON.stringify(next))
    setPreviewState(next)
  }

  useEffect(() => {
    if (!previewState) return
    let next: SetupGuidePreviewState | null = null
    if (
      pathname === APP_ROUTES.dashboard.automations.root &&
      !previewState.aiSettingsVisited
    ) {
      next = { ...previewState, aiSettingsVisited: true }
    } else if (
      pathname === APP_ROUTES.dashboard.automations.knowledge &&
      previewState.aiSettingsVisited &&
      !previewState.storeVisited
    ) {
      next = { ...previewState, storeVisited: true }
    } else if (
      pathname === APP_ROUTES.dashboard.channels.root &&
      !previewState.channelsVisited
    ) {
      next = { ...previewState, channelsVisited: true }
    } else if (
      pathname === APP_ROUTES.dashboard.team &&
      !previewState.teamVisited
    ) {
      next = { ...previewState, teamVisited: true }
    } else if (
      pathname === APP_ROUTES.dashboard.inbox &&
      previewState.phase === "optional" &&
      !previewState.inboxVisited
    ) {
      next = { ...previewState, inboxVisited: true }
    }
    if (next) {
      window.sessionStorage.setItem(previewKey, JSON.stringify(next))
      const timeout = window.setTimeout(() => setPreviewState(next), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [pathname, previewKey, previewState])

  useEffect(() => {
    if (
      previewState ||
      pathname !== APP_ROUTES.dashboard.automations.root ||
      !guideState ||
      finished ||
      guideState.aiSettingsVisited ||
      aiVisitInFlight.current
    )
      return
    aiVisitInFlight.current = true
    void updateSetupGuideState(storeId, { action: "VISIT_AI" })
      .then((next) => setGuideState(next))
      .catch(() => setActionError(true))
      .finally(() => {
        aiVisitInFlight.current = false
      })
  }, [finished, guideState, pathname, previewState, storeId])

  useEffect(() => {
    if (previewState || !guideState || finished || guideState.phase === "done")
      return
    const action =
      pathname === APP_ROUTES.dashboard.channels.root &&
      !guideState.channelsVisited
        ? "VISIT_CHANNELS"
        : pathname === APP_ROUTES.dashboard.team && !guideState.teamVisited
          ? "VISIT_TEAM"
          : null
    if (!action) return
    void updateSetupGuideState(storeId, { action })
      .then(setGuideState)
      .catch(() => setActionError(true))
  }, [finished, guideState, pathname, previewState, storeId])

  async function applyAction(
    action: Exclude<SetupGuideUpdate["action"], "IMPORT_LEGACY">
  ) {
    if (updating) return
    if (previewState) {
      const next = {
        ...previewState,
        phase:
          action === "FINISH"
            ? "done"
            : action === "CONTINUE_OPTIONAL"
              ? "optional"
              : previewState.phase,
        skippedFaq: action === "SKIP_FAQ" || previewState.skippedFaq,
      } satisfies SetupGuidePreviewState
      savePreviewState(next)
      if (action === "FINISH") setOpen(false)
      return
    }
    setUpdating(true)
    setActionError(false)
    try {
      requestRef.current?.abort()
      const next = await updateSetupGuideState(storeId, { action })
      setGuideState(next)
      if (action === "FINISH") setOpen(false)
    } catch {
      setActionError(true)
    } finally {
      setUpdating(false)
    }
  }

  const refresh = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    const legacyValue = window.localStorage.getItem(storageKey)
    const guideRequest = legacyValue
      ? updateSetupGuideState(
          storeId,
          { action: "IMPORT_LEGACY", ...readLegacyGuideState(legacyValue) },
          controller.signal
        )
      : getSetupGuideState(storeId, controller.signal)
    const [guide, knowledge, questions] = await Promise.allSettled([
      guideRequest,
      getStoreKnowledge(storeId, controller.signal),
      getProductQuestions(storeId, {
        status: "ALL",
        limit: 1,
        signal: controller.signal,
      }),
    ])
    if (controller.signal.aborted) return
    if (guide.status === "fulfilled") {
      setGuideState(guide.value)
      if (legacyValue) window.localStorage.removeItem(storageKey)
    } else {
      setError(true)
      return
    }
    if (knowledge.status === "fulfilled" && questions.status === "fulfilled") {
      setSnapshot({
        knowledge: knowledge.value,
        questions: questions.value.summary,
      })
      setError(false)
    } else {
      setError(true)
    }
  }, [storageKey, storeId])

  useEffect(() => {
    if (finished || hiddenForConversation) return
    const timeout = window.setTimeout(() => void refresh(), 0)
    return () => {
      window.clearTimeout(timeout)
      requestRef.current?.abort()
    }
  }, [finished, hiddenForConversation, pathname, refresh])

  useEffect(() => {
    if (finished || hiddenForConversation) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [finished, hiddenForConversation, refresh])

  useEffect(() => {
    if (finished || hiddenForConversation) return
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [finished, hiddenForConversation, refresh])

  const actualProgress =
    snapshot && guideState
      ? getSetupGuideProgress(snapshot.knowledge, snapshot.questions, {
          aiSettingsVisited: guideState.aiSettingsVisited,
          channelsVisited: guideState.channelsVisited,
          teamVisited: guideState.teamVisited,
          canManageTeam,
        })
      : null
  const progress =
    actualProgress && previewState
      ? getSetupGuidePreviewProgress(actualProgress, previewState)
      : actualProgress
  const nextAction =
    progress && effectiveState
      ? getGuideAction(
          progress,
          snapshot?.questions ?? null,
          effectiveState,
          canManageTeam
        )
      : null
  const bubbleKey = nextAction
    ? `${previewState ? previewKey : storageKey}:bubble:${nextAction.id}`
    : null

  useEffect(() => {
    if (!bubbleKey || finished || open || hiddenForConversation) return
    if (window.sessionStorage.getItem(bubbleKey) === "dismissed") return
    const timeout = window.setTimeout(
      () => setVisibleBubbleKey(bubbleKey),
      lastOpenedActionId === nextAction?.id ? 30_000 : 350
    )
    return () => window.clearTimeout(timeout)
  }, [
    bubbleKey,
    finished,
    hiddenForConversation,
    lastOpenedActionId,
    nextAction?.id,
    open,
  ])

  if (!effectiveState || finished || hiddenForConversation) return null

  function dismissBubble() {
    if (bubbleKey) window.sessionStorage.setItem(bubbleKey, "dismissed")
    setVisibleBubbleKey(null)
  }

  const essentialInProgress = (progress?.percentage ?? 0) < 100
  const isCelebration = nextAction?.id === "CELEBRATE"
  const isOptionalDone = nextAction?.id === "DONE"

  return (
    <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6">
      {visibleBubbleKey === bubbleKey && nextAction && !open ? (
        <div className="absolute right-0 bottom-full mb-2.5 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {isCelebration || isOptionalDone
                  ? "Güzel haber"
                  : nextAction.optional
                    ? "Küçük bir öneri"
                    : "Sıradaki küçük adım"}
              </p>
              <p className="mt-1 text-xs leading-5 font-semibold">
                {nextAction.title}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissBubble}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Kurulum ipucunu kapat"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisibleBubbleKey(null)
              setLastOpenedActionId(nextAction.id)
              setOpen(true)
              void refresh()
            }}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Rehberi aç
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
          </button>
        </div>
      ) : null}

      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (value) {
            setVisibleBubbleKey(null)
            setLastOpenedActionId(nextAction?.id ?? null)
            void refresh()
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`Kurulum rehberini aç, temel hazırlık ${progress?.percentage ?? 0} yüzde tamamlandı`}
          >
            <HugeiconsIcon icon={AiSparklesIcon} className="size-4" />
            <span>
              {essentialInProgress ? "İlk adımlar" : "Kurulum rehberi"}
            </span>
            {essentialInProgress ? (
              <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[11px] tabular-nums">
                {progress ? `%${progress.percentage}` : "…"}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-2xl border border-border p-0 shadow-xl"
        >
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">
                  {essentialInProgress ? "İlk adımlar" : "Kurulum rehberi"}
                </h2>
                {essentialInProgress ? (
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label="Temel kurulum ilerlemesi"
                      aria-valuenow={progress?.percentage ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${progress?.percentage ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums">
                      {progress?.percentage ?? 0}%
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    İsterseniz önerilen adımlarla devam edin.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Kurulum panelini kapat"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>
          </div>

          {progress && nextAction ? (
            <div className="p-5">
              {error ? (
                <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                  Güncel durum alınamadı; son kaydedilen bilgiler gösteriliyor.
                </p>
              ) : null}
              {actionError ? (
                <p className="mb-3 text-xs text-destructive" role="alert">
                  Rehber kaydedilemedi. Lütfen tekrar deneyin.
                </p>
              ) : null}
              {isCelebration || isOptionalDone ? (
                <div className="text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <HugeiconsIcon
                      icon={
                        isCelebration ? AiSparklesIcon : CheckmarkCircle01Icon
                      }
                      className="size-6"
                    />
                  </span>
                  <h3 className="mt-3 text-base font-semibold">
                    {nextAction.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {nextAction.description}
                  </p>
                  {isCelebration ? (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void applyAction("CONTINUE_OPTIONAL")}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Kuruluma devam et
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-3.5"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void applyAction("FINISH")}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Rehberi bitir
                    </button>
                  )}
                  {isCelebration ? (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => void applyAction("FINISH")}
                      className="mt-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Burada bitir
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                    {nextAction.optional
                      ? "İsteğe bağlı adım"
                      : "Sıradaki adım"}
                  </p>
                  <h3 className="mt-2 text-base leading-6 font-semibold">
                    {nextAction.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {nextAction.description}
                  </p>
                  {nextAction.href ? (
                    <Link
                      href={nextAction.href}
                      onClick={() => {
                        if (previewState) {
                          if (nextAction.id === "CHANNELS") {
                            savePreviewState({
                              ...previewState,
                              channelsVisited: true,
                            })
                          } else if (nextAction.id === "TEAM") {
                            savePreviewState({
                              ...previewState,
                              teamVisited: true,
                            })
                          } else if (nextAction.id === "STORE") {
                            savePreviewState({
                              ...previewState,
                              storeVisited: true,
                            })
                          } else if (nextAction.id === "FAQ") {
                            savePreviewState({
                              ...previewState,
                              faqVisited: true,
                            })
                          } else if (nextAction.id === "INBOX") {
                            savePreviewState({
                              ...previewState,
                              inboxVisited: true,
                            })
                          }
                        }
                        setOpen(false)
                      }}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {nextAction.cta}
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-3.5"
                      />
                    </Link>
                  ) : null}
                  {nextAction.optional ? (
                    <div className="mt-3 flex items-center justify-center gap-4">
                      {nextAction.id === "FAQ" ? (
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => void applyAction("SKIP_FAQ")}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Bu adımı geç
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void applyAction("FINISH")}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Burada bitir
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="px-5 py-6 text-xs text-muted-foreground">
              {error ? (
                <div className="space-y-3">
                  <p>Kurulum durumu alınamadı.</p>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                    Tekrar dene
                  </button>
                </div>
              ) : (
                "Kurulum durumu yükleniyor…"
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function getGuideAction(
  progress: SetupGuideProgress,
  questions: ProductQuestionPage["summary"] | null,
  state: SetupGuideState,
  canManageTeam: boolean
): GuideAction {
  if (!progress.aiStepComplete) {
    return {
      id: "AI",
      title: "Yanıt ayarlarını gözden geçirin",
      description:
        "Bu sayfayı ziyaret etmeniz yeterli; ayarları değiştirmeniz gerekmiyor.",
      href: `${APP_ROUTES.dashboard.automations.root}?setupGuideTour=1`,
      cta: "Yanıt ayarlarına git",
      optional: false,
    }
  }
  if (!progress.storeInformationAdded) {
    return {
      id: "STORE",
      title: "Mağazanızı kısaca tanıtın",
      description:
        "Marka açıklaması ya da bir mağaza politikası, AI yanıtlarına güvenilir bağlam sağlar.",
      href: APP_ROUTES.dashboard.automations.knowledge,
      cta: "Mağaza bilgilerine git",
      optional: false,
    }
  }
  if (!state.channelsVisited) {
    return {
      id: "CHANNELS",
      title: "Kanallarınızı tanıyın",
      description:
        "Yeni kanal eklemeyi, bağlantı işlemlerini ve güncelleme düğmelerini kısaca görün.",
      href: `${APP_ROUTES.dashboard.channels.root}?setupGuideTour=1`,
      cta: "Kanalları keşfet",
      optional: false,
    }
  }
  if (canManageTeam && !state.teamVisited) {
    return {
      id: "TEAM",
      title: "Ekip ve yetkileri tanıyın",
      description:
        "Ekip üyelerini davet etmeyi ve mağaza erişimlerini yönetmeyi öğrenin.",
      href: `${APP_ROUTES.dashboard.team}?setupGuideTour=1`,
      cta: "Ekip sayfasına git",
      optional: false,
    }
  }
  if (state.phase === "essential") {
    return {
      id: "CELEBRATE",
      title: "Harika, temel hazırlık tamam!",
      description:
        "Mağazanız kullanıma hazır. İsterseniz birkaç kısa öneriyle devam edin, isterseniz rehberi burada bitirin.",
      optional: false,
    }
  }
  if (!progress.faqAdded && !state.skippedFaq) {
    return {
      id: "FAQ",
      title: "Sık gelen bir soruyu ekleyin",
      description:
        "Müşterilerinizin sık sorduğu bir soru ve doğrulanmış cevabını kaydedebilirsiniz.",
      href: `${APP_ROUTES.dashboard.automations.knowledge}#faq`,
      cta: "SSS ekle",
      optional: true,
    }
  }
  if (!progress.hasAnsweredQuestion) {
    return {
      id: "INBOX",
      title: progress.hasQuestions
        ? "İlk müşteri sorusuna göz atın"
        : "Gelen kutusunu keşfedin",
      description:
        questions === null
          ? "Soru durumu şu anda alınamadı; gelen kutusundan kontrol edebilirsiniz."
          : progress.hasQuestions
            ? "Bir taslağı inceleyerek ilk yanıtınızı güvenle hazırlayabilirsiniz."
            : "Henüz soru gelmediyse yapmanız gereken bir şey yok. Geldiğinde burada görünecek.",
      href: APP_ROUTES.dashboard.inbox,
      cta: "Gelen kutusuna git",
      optional: true,
    }
  }
  return {
    id: "DONE",
    title: "Rehber tamamlandı!",
    description:
      "Artık kendi hızınızda devam edebilirsiniz. Rehberi bitirdiğinizde bu düğme bir daha görünmeyecek.",
    optional: true,
  }
}
