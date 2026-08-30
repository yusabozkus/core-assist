import * as React from "react"

const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribeToDesktopQuery(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)

  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches
}

export function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribeToDesktopQuery,
    getDesktopSnapshot,
    () => false
  )
}
