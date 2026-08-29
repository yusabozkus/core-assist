"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Sun01Icon, Moon02Icon } from "@hugeicons/core-free-icons"

const subscribeToHydration = () => () => undefined

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-label="Toggle theme"
      >
        <span className="size-4 opacity-0" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={className}
      aria-label="Temayı değiştir"
      title={isDark ? "Aydınlık Moda Geç" : "Karanlık Moda Geç"}
    >
      {isDark ? (
        <HugeiconsIcon
          icon={Sun01Icon}
          className="size-4 text-muted-foreground hover:text-foreground transition-colors"
        />
      ) : (
        <HugeiconsIcon
          icon={Moon02Icon}
          className="size-4 text-muted-foreground hover:text-foreground transition-colors"
        />
      )}
    </Button>
  )
}
