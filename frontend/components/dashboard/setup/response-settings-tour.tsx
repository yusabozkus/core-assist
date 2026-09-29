"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

const responseSettingsSteps = [
  {
    targets: ['[data-response-tour-section="automation"]'],
    title: "Yanıt otomasyonu",
    description:
      "Sorular geldiğinde AI'ın nasıl çalışacağını buradan seçersiniz: manuel, otomatik taslak veya güvenli otomatik yanıt. Şimdilik bir seçim yapmanız gerekmiyor.",
  },
  {
    targets: ['[data-response-tour-section="behavior"]'],
    title: "Yanıt biçimi",
    description:
      "AI'ın üslubunu, cevap uzunluğunu ve karşılama biçimini burada ayarlarsınız. Boy ve kiloya göre tahmini beden önerisi de bu bölümde yönetilir.",
  },
  {
    targets: ['[data-response-tour-section="instructions"]'],
    title: "Özel AI talimatları",
    description:
      "Mağazanıza özgü kalıcı kuralları buraya ekleyebilirsiniz. Örneğin kesin teslimat tarihi sözü vermemesini isteyebilirsiniz. Bunu daha sonra da yapabilirsiniz.",
  },
] as const

export type GuidedTourStep = {
  targets: readonly string[]
  title: string
  description: string
}

type Spotlight = {
  top: number
  right: number
  bottom: number
  left: number
}

export function ResponseSettingsTour({
  onClose,
  onStepChange,
}: {
  onClose: () => void
  onStepChange: (step: number) => void
}) {
  return (
    <GuidedSpotlightTour
      eyebrow="Yanıt ayarları"
      steps={responseSettingsSteps}
      onClose={onClose}
      onStepChange={onStepChange}
    />
  )
}

export function GuidedSpotlightTour({
  eyebrow,
  steps,
  onClose,
  onStepChange,
}: {
  eyebrow: string
  steps: readonly GuidedTourStep[]
  onClose: () => void
  onStepChange?: (step: number) => void
}) {
  const [step, setStep] = useState(0)
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLButtonElement>("[data-tour-primary]")
        ?.focus()
    )
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
      if (event.key !== "Tab") return
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)"
        ) ?? []
      )
      const first = buttons[0]
      const last = buttons.at(-1)
      if (!first || !last) return
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        const targetButton = event.shiftKey ? last : first
        targetButton.focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("keydown", onKeyDown)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [onClose])

  useEffect(() => {
    const targets = steps[step].targets
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((element): element is HTMLElement => element !== null)
    if (!targets.length) return

    let frame = 0
    const measure = () => {
      const bounds = targets.map((target) => target.getBoundingClientRect())
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const left = Math.max(
        8,
        Math.min(
          Math.min(...bounds.map((rect) => rect.left)) - 6,
          viewportWidth - 16
        )
      )
      const top = Math.max(
        8,
        Math.min(
          Math.min(...bounds.map((rect) => rect.top)) - 6,
          viewportHeight - 16
        )
      )
      setSpotlight({
        left,
        top,
        right: Math.max(
          left + 8,
          Math.min(
            Math.max(...bounds.map((rect) => rect.right)) + 6,
            viewportWidth - 8
          )
        ),
        bottom: Math.max(
          top + 8,
          Math.min(
            Math.max(...bounds.map((rect) => rect.bottom)) + 6,
            viewportHeight - 8
          )
        ),
      })
    }
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }
    targets[0].scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
      inline: "nearest",
    })
    scheduleMeasure()
    const observer = new ResizeObserver(scheduleMeasure)
    targets.forEach((target) => observer.observe(target))
    window.addEventListener("scroll", scheduleMeasure, true)
    window.addEventListener("resize", scheduleMeasure)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", scheduleMeasure, true)
      window.removeEventListener("resize", scheduleMeasure)
    }
  }, [step, steps])

  function moveTo(nextStep: number) {
    setStep(nextStep)
    onStepChange?.(nextStep)
  }

  if (typeof document === "undefined") return null

  const current = steps[step]
  const backdropClass = "fixed z-[100] bg-black/70"

  return createPortal(
    <>
      {spotlight ? (
        <>
          <div
            className={backdropClass}
            style={{ top: 0, left: 0, right: 0, height: spotlight.top }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{ top: spotlight.bottom, left: 0, right: 0, bottom: 0 }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{
              top: spotlight.top,
              left: 0,
              width: spotlight.left,
              height: spotlight.bottom - spotlight.top,
            }}
            aria-hidden="true"
          />
          <div
            className={backdropClass}
            style={{
              top: spotlight.top,
              left: spotlight.right,
              right: 0,
              height: spotlight.bottom - spotlight.top,
            }}
            aria-hidden="true"
          />
          <div
            className="fixed z-[100]"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.right - spotlight.left,
              height: spotlight.bottom - spotlight.top,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none fixed z-[101] rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.right - spotlight.left,
              height: spotlight.bottom - spotlight.top,
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[100] bg-black/70" aria-hidden="true" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-settings-tour-title"
        aria-describedby="response-settings-tour-description"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[102] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-popover p-5 text-popover-foreground shadow-2xl sm:right-6 sm:bottom-6"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="text-[11px] font-semibold tracking-wide text-primary uppercase">
            {eyebrow} · {step + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kısa turu kapat"
            className="rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>
        <h2
          id="response-settings-tour-title"
          className="mt-3 text-base font-semibold"
        >
          {current.title}
        </h2>
        <p
          id="response-settings-tour-description"
          className="mt-1.5 text-sm leading-6 text-muted-foreground"
        >
          {current.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => moveTo(step - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              Önceki
            </Button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Turu geç
            </button>
          )}
          <Button
            data-tour-primary
            type="button"
            size="sm"
            onClick={() =>
              step === steps.length - 1 ? onClose() : moveTo(step + 1)
            }
          >
            {step === steps.length - 1 ? "Tamam" : "Sonraki"}
            {step === steps.length - 1 ? null : (
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </>,
    document.body
  )
}
