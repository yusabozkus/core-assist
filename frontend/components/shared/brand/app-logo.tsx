'use client'

import Link from "next/link"

import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useTheme } from "next-themes"

export function AppLogo({
  href = APP_ROUTES.dashboard.root,
  className,
  showIcon,
  showText = true,
  description,
  iconSize = 40,
  textWidth = 140,
  fullDark
}: {
  href?: string
  className?: string
  showIcon?: boolean
  showText?: boolean
  description?: string
  iconSize?: number
  textWidth?: number
  fullDark?: boolean
}) {

  const theme = useTheme().resolvedTheme

  return (
    <Link
      href={href}
      aria-label="Core Asistan ana sayfa"
      className={cn(
        "group inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
        className
      )}
    >
      <div className="flex flex-row items-center gap-3">
        {showIcon && (
          <Image
            src={fullDark ||theme === "dark" ? "/logo/icon-dark.png" : "/logo/icon.png"}
            alt="Core Asistan Logo"
            width={iconSize}
            height={iconSize}
            className="mt-2"
          />
        )}
        <div>
          {showText && (
            <Image
              src={fullDark || theme === "dark" ? "/logo/text-dark.png" : "/logo/text.png"}
              alt="Core Asistan Logo"
              height={0}
              width={textWidth}
              className="-ml-1"
            />
          )}
          <span className="-mt-1 block text-[9px] leading-none font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            {description}
          </span>
        </div>
      </div>
    </Link>
  )
}
