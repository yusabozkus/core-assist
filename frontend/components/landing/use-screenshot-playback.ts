"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { useMotionValue } from "motion/react"

const SLIDE_DURATION_MS = 3000

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function isDocumentVisible() {
  return document.visibilityState === "visible"
}

function getServerVisibility() {
  return false
}

export function useScreenshotPlayback({
  activeId,
  enabled,
  onAdvance,
}: {
  activeId: string
  enabled: boolean
  onAdvance: () => void
}) {
  const progress = useMotionValue(0)
  const elapsed = useRef(0)
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    isDocumentVisible,
    getServerVisibility
  )

  const resetProgress = useCallback(() => {
    elapsed.current = 0
    progress.set(0)
  }, [progress])

  useEffect(() => {
    resetProgress()
  }, [activeId, resetProgress])

  useEffect(() => {
    if (!enabled || !pageVisible) return

    let previousTime = performance.now()
    let frame: number
    const tick = (time: number) => {
      // A hidden tab must not count background time toward the next slide.
      if (document.visibilityState !== "visible") return
      elapsed.current += time - previousTime
      previousTime = time

      progress.set(Math.min(elapsed.current / SLIDE_DURATION_MS, 1))
      if (elapsed.current >= SLIDE_DURATION_MS) {
        onAdvance()
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [activeId, enabled, onAdvance, pageVisible, progress])

  return { progress, resetProgress }
}
