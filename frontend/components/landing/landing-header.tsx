"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"

import { LandingBrand } from "@/components/landing/landing-brand"
import { LANDING_NAVIGATION } from "@/constants/landing"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const scrolledRef = useRef(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { scrollY } = useScroll()
  const reducedMotion = useReducedMotion()
  const hasSurface = isScrolled || isMenuOpen

  useMotionValueEvent(scrollY, "change", (position) => {
    const nextIsScrolled = position > 25
    if (scrolledRef.current !== nextIsScrolled) {
      scrolledRef.current = nextIsScrolled
      setIsScrolled(nextIsScrolled)
    }
  })

  useEffect(() => {
    if (!isMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    const desktopQuery = window.matchMedia("(min-width: 1024px)")
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsMenuOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown)
    desktopQuery.addEventListener("change", handleViewportChange)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown)
      desktopQuery.removeEventListener("change", handleViewportChange)
    }
  }, [isMenuOpen])

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 px-3 sm:px-6",
        !reducedMotion && "transition-[padding] duration-300",
        isScrolled ? "pt-3" : "pt-5 sm:pt-7"
      )}
    >
      <div
        className={cn(
          "relative mx-auto max-w-[1240px] rounded-2xl border",
          !reducedMotion &&
            "transition-[background-color,border-color,box-shadow] duration-300",
          hasSurface
            ? "border-[#17281f]/10 bg-[#fbfcf9]/95 shadow-[0_8px_32px_-16px_rgba(23,40,31,0.2)] supports-[backdrop-filter]:bg-[#fbfcf9]/75 supports-[backdrop-filter]:backdrop-blur-xl"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <LandingBrand />

          <nav
            aria-label="Ana navigasyon"
            className="hidden items-center gap-0.5 lg:flex"
          >
            {LANDING_NAVIGATION.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#58645b] transition-colors hover:bg-[#17281f]/[0.04] hover:text-[#17281f] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={APP_ROUTES.login}
              className="hidden h-10 items-center rounded-lg px-2.5 text-[13px] font-semibold text-[#35413c] transition-colors hover:text-[#245d46] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none sm:inline-flex"
            >
              Giriş yap
            </Link>
            <Link
              href={APP_ROUTES.login}
              className="group hidden h-10 items-center gap-3 rounded-xl bg-[#17281f] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#245d46] focus-visible:ring-2 focus-visible:ring-[#245d46] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfcf9] focus-visible:outline-none min-[390px]:inline-flex"
            >
              Ücretsiz dene
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
              />
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={isMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={isMenuOpen}
              aria-controls="landing-mobile-navigation"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#17281f]/12 text-[#17281f] transition-colors hover:bg-[#17281f]/[0.04] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none lg:hidden"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute h-[1.5px] w-4 rounded-full bg-current motion-safe:transition-transform motion-safe:duration-200",
                  isMenuOpen ? "rotate-45" : "-translate-y-[3px]"
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute h-[1.5px] w-4 rounded-full bg-current motion-safe:transition-transform motion-safe:duration-200",
                  isMenuOpen ? "-rotate-45" : "translate-y-[3px]"
                )}
              />
            </button>
          </div>
        </div>

        <nav
          id="landing-mobile-navigation"
          aria-label="Mobil navigasyon"
          hidden={!isMenuOpen}
          className="border-t border-[#17281f]/8 px-5 pt-3 pb-5 lg:hidden"
        >
          <div className="divide-y divide-[#17281f]/6">
            {LANDING_NAVIGATION.map((link, index) => (
              <a
                key={link.id}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="group flex items-center gap-4 rounded-md py-4 text-[15px] font-medium text-[#17281f] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none"
              >
                <span className="text-[11px] font-normal text-[#849084] tabular-nums">
                  0{index + 1}
                </span>
                {link.label}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="ml-auto size-4 text-[#849084] transition-colors group-hover:text-[#245d46]"
                />
              </a>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-[#17281f]/8 pt-4">
            <Link
              href={APP_ROUTES.login}
              onClick={() => setIsMenuOpen(false)}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#17281f]/12 text-sm font-semibold text-[#17281f] hover:bg-[#17281f]/[0.04] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none"
            >
              Giriş yap
            </Link>
            <Link
              href={APP_ROUTES.login}
              onClick={() => setIsMenuOpen(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#17281f] text-sm font-semibold text-white hover:bg-[#245d46] focus-visible:ring-2 focus-visible:ring-[#245d46]/30 focus-visible:outline-none"
            >
              Ücretsiz dene
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
