"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react"

export const WorkflowProgressContext =
  createContext<MotionValue<number> | null>(null)

export function WorkflowReveal({
  children,
  className,
  at = 0.16,
  distance = 18,
}: {
  children: ReactNode
  className?: string
  at?: number
  distance?: number
}) {
  const contextProgress = useContext(WorkflowProgressContext)
  const fallbackProgress = useMotionValue(1)
  const progress = contextProgress ?? fallbackProgress
  const reduceMotion = useReducedMotion()
  const opacity = useTransform(progress, [at, at + 0.14], [0.35, 1])
  const offset = useTransform(progress, [at, at + 0.14], [distance, 0])
  const y = useTransform(offset, (value) => Math.round(value))

  return (
    <motion.div
      className={className}
      style={reduceMotion ? undefined : { opacity, y }}
    >
      {children}
    </motion.div>
  )
}
