"use client"

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
  fullDark,
  noLink,
  contentClassName,
}: {
  href?: string
  className?: string
  showIcon?: boolean
  showText?: boolean
  description?: string
  iconSize?: number
  textWidth?: number
  fullDark?: boolean
  noLink?: boolean
  contentClassName?: string
}) {
  const theme = useTheme().resolvedTheme

  if (noLink) {
    return (
      <AppLogoContent
        contentClassName={contentClassName}
        showIcon={showIcon}
        showText={showText}
        description={description}
        fullDark={fullDark}
        theme={theme}
        iconSize={iconSize}
        textWidth={textWidth}
      />
    )
  }

  return (
    <Link
      href={href}
      aria-label="Core Asistan ana sayfa"
      className={cn(
        "group inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
        className
      )}
    >
      <AppLogoContent
        contentClassName={contentClassName}
        showIcon={showIcon}
        showText={showText}
        description={description}
        fullDark={fullDark}
        theme={theme}
        iconSize={iconSize}
        textWidth={textWidth}
      />
    </Link>
  )
}

type AppLogoContentProps = {
  contentClassName?: string
  showIcon?: boolean
  showText?: boolean
  description?: string
  fullDark?: boolean
  theme?: string
  iconSize: number
  textWidth: number
}

const AppLogoContent = ({
  contentClassName,
  showIcon,
  showText,
  description,
  fullDark,
  theme,
  iconSize,
  textWidth,
}: AppLogoContentProps) => {
  return (
    <div
      className={cn(
        contentClassName ? contentClassName : "flex flex-row items-center gap-3"
      )}
    >
      {showIcon && (
        <Image
          src={
            fullDark || theme === "dark"
              ? "/logo/icon-dark.png"
              : "/logo/icon.png"
          }
          alt="Core Asistan Logo"
          width={iconSize}
          height={iconSize}
          className="mt-2"
        />
      )}
      <div>
        {showText && (
          <Image
            src={
              fullDark || theme === "dark"
                ? "/logo/text-dark.png"
                : "/logo/text.png"
            }
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
  )
}
