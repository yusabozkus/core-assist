"use client"

import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { BILLING_TRIAL } from "@/constants/billing"
import { APP_ROUTES } from "@/constants/site"
import { AppLogo } from "../shared/brand/app-logo"

export function LandingDemoBubble({
  visible,
  onOpen,
}: {
  visible: boolean
  onOpen: () => void
}) {
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          key="landing-demo-bubble"
          aria-label="Core Asistan demosu"
          initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={
            reducedMotion
              ? { opacity: 1, y: 0, scale: 1 }
              : {
                  opacity: 1,
                  y: [0, -5, 1, 0],
                  rotate: [0, 0.2, -0.15, 0],
                  scale: 1,
                }
          }
          exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.25, ease: "easeOut" },
                  scale: { duration: 0.25, ease: "easeOut" },
                  y: {
                    duration: 5.4,
                    ease: "easeInOut",
                    repeat: Infinity,
                  },
                  rotate: {
                    duration: 5.4,
                    ease: "easeInOut",
                    repeat: Infinity,
                  },
                }
          }
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 w-[240px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] rounded-br-lg border border-[#d5e2ce] bg-[#fbfcf9] shadow-[0_12px_40px_-12px_rgba(23,47,36,0.28)] sm:right-2 sm:bottom-6 sm:w-[244px]"
        >
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="group flex w-full items-center gap-3 bg-[#173b2a] px-3.5 py-3 text-left text-white transition-colors hover:bg-[#245d46] focus-visible:-outline-offset-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d9eeae] text-[#245d46]">
              <AppLogo
                showIcon={true}
                showText={false}
                noLink={true}
                iconSize={30}
                contentClassName="flex flex-row items-center justify-center pb-1.5"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">
                Demoyu deneyin
              </span>
              <span className="mt-0.5 block text-[11px] text-[#d0e1d4]">
                Soru sorun, yanıtı görün.
              </span>
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 shrink-0 text-[#d9eeae] motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
            />
          </button>
          <Link
            href={APP_ROUTES.login}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] text-[#607462] transition-colors hover:bg-[#edf3e7] hover:text-[#245d46] focus-visible:-outline-offset-4"
          >
            <span className="font-semibold text-[#245d46]">
              {BILLING_TRIAL.days} gün ücretsiz
            </span>
            <span aria-hidden="true">·</span>
            Kart bilgisi gerekmez
          </Link>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
