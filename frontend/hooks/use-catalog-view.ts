"use client"

import { useSyncExternalStore } from "react"

import {
  PRODUCT_CATALOG_VIEW_STORAGE_KEY,
  type ProductCatalogView,
} from "@/constants/catalog"

const VIEW_CHANGE_EVENT = "coreassist:catalog-view-change"
let fallbackView: ProductCatalogView | null = null

function getView(): ProductCatalogView | null {
  if (fallbackView) return fallbackView
  try {
    const stored = window.localStorage.getItem(PRODUCT_CATALOG_VIEW_STORAGE_KEY)
    return stored === "compact" ? "compact" : "standard"
  } catch {
    return "standard"
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PRODUCT_CATALOG_VIEW_STORAGE_KEY || event.key === null)
      onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(VIEW_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(VIEW_CHANGE_EVENT, onChange)
  }
}

function setView(view: ProductCatalogView) {
  try {
    window.localStorage.setItem(PRODUCT_CATALOG_VIEW_STORAGE_KEY, view)
    fallbackView = null
  } catch {
    // Keep the selection usable when browser storage is unavailable.
    fallbackView = view
  }
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT))
}

const getServerView = (): ProductCatalogView | null => null

export function useCatalogView() {
  const view = useSyncExternalStore(subscribe, getView, getServerView)
  return [view, setView] as const
}
