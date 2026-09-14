"use client"

import { useRef } from "react"
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import styles from "./landing.module.css"

const words =
  "Bir soru gelir. Doğru ürün bulunur. Bilgi doğrulanır. Mağazanızın sesiyle bir cevap hazırlanır.".split(
    " "
  )

export function LandingStatement() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 55%"],
  })
  const reduceMotion = useReducedMotion()

  return (
    <section
      ref={ref}
      className={styles.statement}
      aria-label="Core Asistan yanıt akışı"
    >
      <div
        className={`${styles.container} grid gap-8 lg:grid-cols-[1fr_3fr] lg:gap-14`}
      >
        <p className={`${styles.eyebrow} self-start pt-4 text-[#788572]`}>
          Her cevapta aynı özen
        </p>
        <p className={styles.statementText}>
          <span className="sr-only">{words.join(" ")}</span>
          {words.map((word, index) => (
            <StatementWord
              key={index}
              word={word}
              progress={scrollYProgress}
              range={[index / words.length, (index + 1) / words.length]}
              reducedMotion={Boolean(reduceMotion)}
            />
          ))}
        </p>
      </div>
    </section>
  )
}

function StatementWord({
  word,
  progress,
  range,
  reducedMotion,
}: {
  word: string
  progress: MotionValue<number>
  range: [number, number]
  reducedMotion: boolean
}) {
  const opacity = useTransform(progress, range, [0, 1])
  return (
    <span className={styles.statementWord} aria-hidden="true">
      {word}
      <motion.span
        className={styles.statementInk}
        style={{ opacity: reducedMotion ? 1 : opacity }}
      >
        {word}
      </motion.span>
    </span>
  )
}
