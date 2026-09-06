"use client"

import { useCallback, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react"
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LandingScreenshot } from "@/constants/landing-screenshots"
import { cn } from "@/lib/utils"

import { AppScreenshot } from "./app-screenshot"
import { LandingReveal } from "./landing-reveal"
import { useScreenshotPlayback } from "./use-screenshot-playback"
import styles from "./landing.module.css"

export function ProductTourSection({
  screenshots,
}: {
  screenshots: readonly LandingScreenshot[]
}) {
  const [selectedId, setSelectedId] = useState<string>(screenshots[0].id)
  const [readySrc, setReadySrc] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false)
  const [slideDirection, setSlideDirection] = useState(1)
  const panelRef = useRef<HTMLDivElement>(null)
  const inView = useInView(panelRef, { amount: 0.2 })
  const reducedMotion = useReducedMotion()
  const selectedScreenshot =
    screenshots.find((screenshot) => screenshot.id === selectedId) ??
    screenshots[0]
  const advanceSlide = useCallback(() => {
    setSlideDirection(1)
    setSelectedId((current) => {
      const currentIndex = screenshots.findIndex(
        (screenshot) => screenshot.id === current
      )
      return screenshots[(currentIndex + 1) % screenshots.length].id
    })
  }, [screenshots])
  const selectSlide = (nextId: string) => {
    const currentIndex = screenshots.findIndex(
      (screenshot) => screenshot.id === selectedId
    )
    const nextIndex = screenshots.findIndex(
      (screenshot) => screenshot.id === nextId
    )

    setSlideDirection(nextIndex >= currentIndex ? 1 : -1)
    setSelectedId(nextId)
  }
  const autoplayEnabled = screenshots.length > 1 && reducedMotion === false
  const { progress, resetProgress } = useScreenshotPlayback({
    activeId: selectedId,
    enabled:
      autoplayEnabled &&
      inView &&
      !isHovered &&
      !isPaused &&
      !isKeyboardFocused &&
      (!selectedScreenshot.available || readySrc === selectedScreenshot.src),
    onAdvance: advanceSlide,
  })

  return (
    <section
      id="product-tour"
      aria-labelledby="product-tour-title"
      className="bg-[#f0f3ea] py-16 sm:py-24"
    >
      <div className={cn(styles.container, "max-w-[1180px]")}>
        <LandingReveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end sm:gap-10">
          <div>
            <p className={cn(styles.eyebrow, "mb-4 text-[#658056]")}>
              Çalışma alanınıza göz atın
            </p>
            <h2 id="product-tour-title" className={styles.sectionTitle}>
              İşin tamamı,
              <br />
              aynı ekranda netleşsin.
            </h2>
          </div>
          <p className="max-w-[340px] text-sm leading-7 text-[#748267]">
            Bir soruyu yanıtlarken ürününüze ulaşın. Günün sonunda yanıt
            akışının nasıl ilerlediğini görün.
          </p>
        </LandingReveal>

        <LandingReveal className="mt-9 sm:mt-12" y={20}>
          <div
            onFocusCapture={(event) => {
              if (event.target.matches(":focus-visible"))
                setIsKeyboardFocused(true)
            }}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setIsKeyboardFocused(false)
            }}
          >
            <div className="mb-6 flex items-center gap-3 sm:gap-5">
              <div
                aria-label="İncelemek istediğiniz ekranı seçin"
                role="group"
                className="grid min-w-0 flex-1 grid-cols-3 gap-2 border-b border-[#d6dfcd] sm:gap-6"
              >
                {screenshots.map((screenshot, index) => (
                  <button
                    key={screenshot.id}
                    id={`product-tour-${screenshot.id}-button`}
                    type="button"
                    aria-pressed={selectedId === screenshot.id}
                    aria-controls="product-tour-screen"
                    onClick={() => {
                      resetProgress()
                      selectSlide(screenshot.id)
                    }}
                    className={cn(
                      "relative -mb-px flex min-h-12 items-center justify-center gap-2 px-1 pt-2 pb-3 text-[11px] font-medium transition-[color,transform] active:scale-[0.97] sm:justify-start sm:gap-3 sm:pb-4 sm:text-sm",
                      selectedId === screenshot.id
                        ? "text-[#283f1e]"
                        : "text-[#7b896e] hover:text-[#395729]"
                    )}
                  >
                    <span className="hidden text-[10px] font-normal tabular-nums opacity-60 sm:inline">
                      0{index + 1}
                    </span>
                    {screenshot.label}
                    {selectedId === screenshot.id && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#456b36]/15"
                      >
                        <motion.span
                          className="block h-full w-full origin-left bg-[#456b36]"
                          style={{ scaleX: autoplayEnabled ? progress : 1 }}
                        />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {autoplayEnabled && (
                <button
                  type="button"
                  onClick={() => setIsPaused((current) => !current)}
                  aria-label={
                    isPaused
                      ? "Otomatik geçişi başlat"
                      : "Otomatik geçişi duraklat"
                  }
                  title={
                    isPaused
                      ? "Otomatik geçişi başlat"
                      : "Otomatik geçişi duraklat"
                  }
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#d6dfcd] text-[#617752] transition-[background-color,transform] hover:bg-white/70 active:scale-90"
                >
                  <HugeiconsIcon
                    icon={isPaused ? PlayIcon : PauseIcon}
                    className="size-4"
                  />
                </button>
              )}
            </div>
            <div
              ref={panelRef}
              id="product-tour-screen"
              role="region"
              aria-labelledby={`product-tour-${selectedScreenshot.id}-button`}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse" ||
                  event.pointerType === "pen"
                )
                  setIsHovered(true)
              }}
              onPointerLeave={() => setIsHovered(false)}
              onPointerCancel={() => setIsHovered(false)}
            >
              <AnimatePresence
                initial={false}
                mode="popLayout"
                custom={slideDirection}
              >
                <motion.div
                  key={selectedScreenshot.id}
                  custom={slideDirection}
                  initial={
                    reducedMotion
                      ? { opacity: 1 }
                      : { opacity: 0, x: slideDirection * 34, scale: 0.985 }
                  }
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: slideDirection * -24, scale: 0.982 }
                  }
                  transition={{
                    duration: reducedMotion ? 0 : 0.46,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <AppScreenshot
                    screenshot={selectedScreenshot}
                    onReady={setReadySrc}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  )
}
