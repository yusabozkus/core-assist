"use client"

import type { PointerEvent } from "react"
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "motion/react"

import { cn } from "@/lib/utils"
import styles from "./footer-wordmark.module.css"

const cursorSpring = { stiffness: 220, damping: 32, mass: 0.6 }

export function FooterWordmark({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const cursorX = useSpring(0, cursorSpring)
  const cursorY = useSpring(0, cursorSpring)
  const spotlight = useMotionTemplate`radial-gradient(240px 150px at ${cursorX}px ${cursorY}px, #416b43 0%, #819d69 34%, rgba(76, 115, 66, 0) 76%)`

  function updateCursor(event: PointerEvent<HTMLParagraphElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return

    const bounds = event.currentTarget.getBoundingClientRect()
    cursorX.set(event.clientX - bounds.left)
    cursorY.set(event.clientY - bounds.top)
  }

  function enterWordmark(event: PointerEvent<HTMLParagraphElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return

    const bounds = event.currentTarget.getBoundingClientRect()
    cursorX.jump(event.clientX - bounds.left)
    cursorY.jump(event.clientY - bounds.top)
  }

  function leaveWordmark() {
    cursorX.stop()
    cursorY.stop()
  }

  return (
    <p
      aria-hidden="true"
      className={cn(styles.wordmark, className)}
      onPointerEnter={enterWordmark}
      onPointerMove={updateCursor}
      onPointerLeave={leaveWordmark}
    >
      CoreAssist
      <motion.span
        className={styles.spotlight}
        style={{ backgroundImage: spotlight }}
      >
        CoreAssist
      </motion.span>
    </p>
  )
}
