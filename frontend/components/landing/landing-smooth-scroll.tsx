"use client"

import { ReactLenis } from "lenis/react"
import "lenis/dist/lenis.css"

const scrollOptions = {
  anchors: { offset: -96 },
  autoRaf: true,
  lerp: 0.12,
  smoothWheel: true,
  syncTouch: false,
  respectReducedMotion: true,
  stopInertiaOnNavigate: true,
} as const

export function LandingSmoothScroll({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReactLenis root options={scrollOptions}>
      {children}
    </ReactLenis>
  )
}
