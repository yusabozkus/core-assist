"use client"

import { useRef, useSyncExternalStore, type RefObject } from "react"
import { useInView, useReducedMotion } from "motion/react"

import styles from "./connection-flow.module.css"

const connectionPaths = [
  "M0 28 H54 Q76 28 76 50 V62 Q76 80 100 80 H160",
  "M0 132 H54 Q76 132 76 110 V98 Q76 80 100 80 H160",
] as const

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function getPageVisibility() {
  return document.visibilityState === "visible"
}

function getServerVisibility() {
  return false
}

function useAmbientMotion(ref: RefObject<Element | null>) {
  const inView = useInView(ref, { amount: 0.2 })
  const reducedMotion = useReducedMotion()
  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    getPageVisibility,
    getServerVisibility
  )

  return inView && pageVisible && !reducedMotion
}

export function ConnectionFlow() {
  const ref = useRef<SVGSVGElement>(null)
  const active = useAmbientMotion(ref)

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 160 160"
      preserveAspectRatio="none"
      data-active={active}
      className={`${styles.flow} pointer-events-none absolute top-1/2 right-[22%] h-40 w-[35%] -translate-y-1/2 overflow-visible`}
      fill="none"
    >
      {connectionPaths.map((path, index) => (
        <g key={path}>
          <path
            d={path}
            stroke="#c5d1bf"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path}
            pathLength={1}
            stroke="#78a578"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="0.14 0.86"
            vectorEffect="non-scaling-stroke"
            className={styles.signalTrail}
            style={{ animationDelay: `${index * -2.4}s` }}
          />
          <path
            d={path}
            pathLength={1}
            stroke="#4e815c"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeDasharray="0.06 0.94"
            vectorEffect="non-scaling-stroke"
            className={styles.signal}
            style={{ animationDelay: `${index * -2.4}s` }}
          />
        </g>
      ))}
      <circle cx="100" cy="80" r="3" fill="#749568" />
    </svg>
  )
}

export function ConnectionReceiver() {
  const ref = useRef<HTMLDivElement>(null)
  const active = useAmbientMotion(ref)

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-active={active}
      className={`${styles.receiver} pointer-events-none absolute top-1/2 left-1/2 -z-10 size-36 -translate-x-1/2 -translate-y-1/2 sm:size-44`}
    >
      <span className="absolute inset-0 rounded-full border border-[#dfe6d7]" />
      <span className={styles.receiverRing} />
    </div>
  )
}
